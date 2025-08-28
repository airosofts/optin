const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://fbvjestoxxhdvoitevug.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidmplc3RveHhoZHZvaXRldnVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg1MTM3MiwiZXhwIjoyMDYxNDI3MzcyfQ.9tZcJdxy2Qe_CvfLZBocq9kvgq8Bsg1QD142llPZfl0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'https://airosofts.com', 'https://www.airosofts.com'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to extract additional request info
const extractRequestInfo = (req) => {
  return {
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent') || '',
    referer: req.get('Referer') || '',
    accept_language: req.get('Accept-Language') || '',
    host: req.get('Host') || '',
    forwarded_for: req.get('X-Forwarded-For') || '',
    origin: req.get('Origin') || ''
  };
};

// Helper function to validate email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate phone number
const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  return phoneRegex.test(cleanPhone);
};

// POST endpoint for demo requests
app.post('/api/demo-request', async (req, res) => {
  try {
    const {
      businessName,
      businessEmail,
      businessPhone,
      businessHours,
      googleMapsLink,
      consent,
      userAgent,
      timestamp,
      referrer,
      screenResolution,
      language,
      timezone
    } = req.body;

    // Validation
    if (!businessName || !businessEmail || !businessPhone || !consent) {
      return res.status(400).json({
        success: false,
        message: 'Business name, email, phone number, and consent are required.'
      });
    }

    if (!validateEmail(businessEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (!validatePhone(businessPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number.'
      });
    }

    if (!consent) {
      return res.status(400).json({
        success: false,
        message: 'Consent is required to proceed with the demo request.'
      });
    }

    // Extract additional request information
    const requestInfo = extractRequestInfo(req);

    // Prepare data for Supabase
    const demoRequestData = {
      business_name: businessName.trim(),
      business_email: businessEmail.trim().toLowerCase(),
      business_phone: businessPhone.trim(),
      business_hours: businessHours?.trim() || null,
      google_maps_link: googleMapsLink?.trim() || null,
      consent_given: consent,
      
      // Tracking information
      user_agent: userAgent || requestInfo.user_agent,
      ip_address: requestInfo.ip_address,
      referrer: referrer || requestInfo.referer,
      screen_resolution: screenResolution || null,
      browser_language: language || requestInfo.accept_language,
      timezone: timezone || null,
      
      // Request metadata
      host: requestInfo.host,
      forwarded_for: requestInfo.forwarded_for,
      origin: requestInfo.origin,
      
      // Timestamps
      created_at: new Date().toISOString(),
      submitted_at: timestamp || new Date().toISOString(),
      
      // Status fields
      status: 'pending',
      demo_generated: false,
      contacted: false
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('opt_in')
      .insert([demoRequestData])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save your request. Please try again.'
      });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'Your demo request has been submitted successfully!',
      data: {
        id: data[0].id,
        business_name: data[0].business_name,
        submitted_at: data[0].created_at
      }
    });

    // Log successful submission (for monitoring)
    console.log(`Demo request submitted: ${businessName} (${businessEmail}) - Phone: ${businessPhone}`);
    
    // TODO: Trigger SMS and email notifications here
    // This is where you would integrate with your messaging service
    // Example: await sendWelcomeSMS(businessPhone, businessName);
    // Example: await sendWelcomeEmail(businessEmail, businessName, data[0].id);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

// GET endpoint to retrieve demo requests (for admin use)
app.get('/api/demo-requests', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('opt_in')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`business_name.ilike.%${search}%,business_email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve demo requests.'
      });
    }

    res.status(200).json({
      success: true,
      data: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// PUT endpoint to update demo request status
app.put('/api/demo-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, demo_generated, contacted, notes } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (typeof demo_generated === 'boolean') updateData.demo_generated = demo_generated;
    if (typeof contacted === 'boolean') updateData.contacted = contacted;
    if (notes) updateData.notes = notes;

    const { data, error } = await supabase
      .from('opt_in')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update demo request.'
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demo request not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Demo request updated successfully.',
      data: data[0]
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running successfully',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Airosofts Demo Request API',
    version: '1.0.0',
    endpoints: {
      'POST /api/demo-request': 'Submit a new demo request',
      'GET /api/demo-requests': 'Get all demo requests (admin)',
      'PUT /api/demo-requests/:id': 'Update demo request status (admin)',
      'GET /health': 'Health check'
    }
  });
});

// Error handling middleware
// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.'
  });
});

// 404 handler - must be last route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    requested: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 Demo API: http://localhost:${PORT}/api/demo-request`);
  console.log(`🔗 Supabase URL: ${supabaseUrl}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Server terminated gracefully...');
  process.exit(0);
});
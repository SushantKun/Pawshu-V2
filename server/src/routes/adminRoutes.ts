import express, { Request, Response, RequestHandler } from 'express';
import Doctor from '../models/Doctor';
import { adminAuth, AuthRequest } from '../middleware/auth';
import { uploadImage } from '../utils/cloudinary';

const router = express.Router();

// @route   POST /api/admin/doctors
// @desc    Create a new doctor
// @access  Private (Admin only)
router.post('/doctors', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /api/admin/doctors - Creating new doctor');
    
    // Validate request body
    if (!req.body) {
      return res.status(400).json({ message: 'Request body is empty' });
    }
    
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      specialization, 
      experience, 
      bio, 
      availability,
      profileImage 
    } = req.body;
    
    // Validate input
    if (!firstName || !lastName || !email || !password || !specialization) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    try {
      // Check if doctor with this email already exists
      const existingDoctor = await Doctor.findOne({ email });
      if (existingDoctor) {
        return res.status(400).json({ message: 'Doctor with this email already exists' });
      }
      
      // Create new doctor
      const doctor = new Doctor({
        firstName,
        lastName,
        email,
        password,
        specialization,
        experience: experience || 0,
        bio: bio || `${firstName} ${lastName} is a ${specialization} specialist.`,
        availability: availability || []
      });
      
      // Handle profile image upload if provided
      if (profileImage && typeof profileImage === 'string') {
        try {
          const uploadResult = await uploadImage(profileImage);
          if (uploadResult) {
            doctor.profileImage = {
              public_id: uploadResult.public_id,
              url: uploadResult.url
            };
          }
        } catch (imageError) {
          console.error('Error uploading profile image:', imageError);
          // Continue with doctor creation even if image upload fails
        }
      }
      
      await doctor.save();
      console.log('Doctor created successfully:', doctor._id);
      
      // Remove password from response
      const doctorResponse = doctor.toObject();
      const { password: _, ...doctorWithoutPassword } = doctorResponse;
      
      res.status(201).json(doctorWithoutPassword);
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ 
        message: 'Database error', 
        error: dbError instanceof Error ? dbError.message : 'Unknown database error' 
      });
    }
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as RequestHandler);

// @route   GET /api/admin/doctors
// @desc    Get all doctors
// @access  Private (Admin only)
router.get('/doctors', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/admin/doctors - Fetching all doctors');
    const doctors = await Doctor.find().select('-password');
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   GET /api/admin/doctors/:id
// @desc    Get doctor by ID
// @access  Private (Admin only)
router.get('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`GET /api/admin/doctors/${req.params.id} - Fetching doctor by ID`);
    const doctor = await Doctor.findById(req.params.id).select('-password');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   PUT /api/admin/doctors/:id
// @desc    Update doctor
// @access  Private (Admin only)
router.put('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`PUT /api/admin/doctors/${req.params.id} - Updating doctor`);
    const { 
      firstName, 
      lastName, 
      email, 
      specialization, 
      experience, 
      bio, 
      availability,
      profileImage 
    } = req.body;
    
    // Find doctor
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Update fields
    if (firstName) doctor.firstName = firstName;
    if (lastName) doctor.lastName = lastName;
    if (email) doctor.email = email;
    if (specialization) doctor.specialization = specialization;
    if (experience !== undefined) doctor.experience = experience;
    if (bio) doctor.bio = bio;
    if (availability) doctor.availability = availability;
    
    // Handle profile image upload if provided
    if (profileImage && typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(profileImage);
        doctor.profileImage = {
          public_id: uploadResult.public_id,
          url: uploadResult.url
        };
      } catch (imageError) {
        console.error('Error uploading profile image:', imageError);
        // Continue with update even if image upload fails
      }
    }
    
    await doctor.save();
    console.log('Doctor updated successfully:', doctor._id);
    
    // Remove password from response
    const doctorResponse = doctor.toObject();
    const { password: _, ...doctorWithoutPassword } = doctorResponse;
    
    res.json(doctorWithoutPassword);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   DELETE /api/admin/doctors/:id
// @desc    Delete doctor
// @access  Private (Admin only)
router.delete('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`DELETE /api/admin/doctors/${req.params.id} - Deleting doctor`);
    const doctor = await Doctor.findById(req.params.id);
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    await Doctor.deleteOne({ _id: req.params.id });
    console.log('Doctor deleted successfully:', req.params.id);
    
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 
/**
 * Doctor Controller
 * 
 * Handles doctor authentication, profile management, and appointment operations.
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Doctor, { IDoctor } from '../models/Doctor';
import Appointment from '../models/Appointment';
import { AuthRequest } from '../types/auth';
import { uploadImage } from '../utils/cloudinary';

/**
 * Login a doctor
 * @route POST /api/doctors/login
 */
export const loginDoctor = async (req: Request, res: Response) => {
  try {
    console.log('Doctor login attempt');
    const { email, password } = req.body;

    console.log('Login attempt for email:', email);

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password in request');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find doctor by email
    const doctor = await Doctor.findOne({ email }).select('+password');
    console.log('Doctor found:', doctor ? `ID: ${doctor._id}, Email: ${doctor.email}` : 'No doctor found');

    if (!doctor) {
      console.log('No doctor found with email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    try {
      const isMatch = await doctor.comparePassword(password);
      console.log('Password match:', isMatch);

      if (!isMatch) {
        console.log('Invalid password for doctor:', email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (passwordError) {
      console.error('Error comparing password:', passwordError);
      return res.status(500).json({ message: 'Error validating credentials' });
    }

    // Create token
    const token = jwt.sign(
      {
        _id: doctor._id,
        name: `${doctor.firstName} ${doctor.lastName}`,
        email: doctor.email,
        isAdmin: false,
        isDoctor: true,
        role: 'doctor'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    // Return token and doctor info (excluding password)
    const doctorInfo = {
      _id: doctor._id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      specialization: doctor.specialization,
      isDoctor: true,
      role: 'doctor'
    };

    console.log('Doctor login successful for:', email);
    res.json({ token, doctor: doctorInfo });
  } catch (error) {
    console.error('Doctor login error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get doctor profile
 * @route GET /api/doctors/profile
 */
export const getDoctorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const doctor = await Doctor.findById(req.user._id).select('-password');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update doctor profile
 * @route PUT /api/doctors/profile
 */
export const updateDoctorProfile = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Doctor authorization successful for path: /profile');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Debug request body
    console.log('Profile update request body keys:', Object.keys(req.body));
    console.log('Profile update request body availability:', req.body.availability);
    console.log('Profile update request body availability[]:', req.body['availability[]']);

    // Create a clean update object
    const updates: Partial<IDoctor> = {};
    
    // Handle basic fields
    const fields = [
      'firstName', 'lastName', 'specialization', 
      'experience', 'bio', 'isActive', 'locationPreference',
      'clinicAddress', 'appointmentDuration', 'bookingFee'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        (updates as any)[field] = req.body[field];
      }
    });
    
    // Special handling for availability array
    console.log('Received availability data:', req.body.availability);
    console.log('Received availability[] data:', req.body['availability[]']);
    
    // Handle availability array specifically 
    if (req.body.availability || req.body['availability[]']) {
      // For form data, the field might be passed as 'availability[]'
      let availabilityData = req.body.availability;
      
      // If it's not an array but we have availability[], use that instead
      if (!Array.isArray(availabilityData) && req.body['availability[]']) {
        availabilityData = req.body['availability[]'];
        console.log('Using availability[] instead:', availabilityData);
      }
      
      // Process the availability data - make sure we handle all cases
      if (Array.isArray(availabilityData)) {
        // Filter out any empty strings
        updates.availability = availabilityData.filter((slot: string) => slot && slot.trim() !== '');
        console.log('Using availability array with entries:', updates.availability);
      } else if (typeof availabilityData === 'string' && availabilityData.trim() !== '') {
        // Single string case
        updates.availability = [availabilityData];
        console.log('Using single availability string:', updates.availability);
      } else if (availabilityData === undefined || availabilityData === null) {
        // Empty case - set to empty array to clear existing
        updates.availability = [];
        console.log('Clearing availability array - no data provided');
      }
    }
    
    // Handle profile image if provided
    if (req.body.profileImage && typeof req.body.profileImage === 'string' && 
        req.body.profileImage.startsWith('data:image/')) {
      try {
        console.log('Uploading new profile image');
        const uploadResult = await uploadImage(req.body.profileImage);
        updates.profileImage = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
        console.log('Profile image uploaded successfully');
      } catch (error) {
        console.error('Error uploading profile image:', error);
        // Continue with update even if image upload fails
      }
    }
    
    console.log('Applying updates:', JSON.stringify(updates));
    
    // Update the doctor profile
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log('Doctor profile updated successfully');
    res.json(updatedDoctor);
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get doctor's appointments
 * @route GET /api/doctors/appointments
 */
export const getDoctorAppointments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Get query parameters for filtering
    const { status, date } = req.query;
    
    // Build filter object
    const filter: any = { doctor: req.user._id };
    
    // Add status filter if provided
    if (status && typeof status === 'string') {
      filter.status = status;
    }
    
    // Add date filter if provided
    if (date && typeof date === 'string' && isValidDate(date)) {
      // Create date range for the given date (entire day)
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      filter.appointmentDate = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    // Fetch appointments with the filter
    const appointments = await Appointment.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ appointmentDate: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Helper function to validate date format (YYYY-MM-DD)
 */
const isValidDate = (dateString: string): boolean => {
  // Check if it's a valid string and matches YYYY-MM-DD format
  if (typeof dateString !== 'string') return false;

  // Check if matches YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  // Check if it's a valid date
  const date = new Date(dateString);
  const timestamp = date.getTime();
  if (isNaN(timestamp)) return false;

  return true;
}; 
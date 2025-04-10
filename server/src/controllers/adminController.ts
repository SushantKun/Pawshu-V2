/**
 * Admin Controller
 * 
 * Handles all admin-related functionality including doctor management,
 * user management, and dashboard data.
 */

import { Request, Response } from 'express';
import Doctor, { IDoctor } from '../models/Doctor';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import Appointment from '../models/Appointment';
import Donation from '../models/Donation';
import { Charity } from '../models/Charity';
import { AuthRequest } from '../types/auth';
import { uploadImage } from '../utils/cloudinary';
import mongoose from 'mongoose';

/**
 * Create a new doctor
 * @route POST /api/admin/doctors
 */
export const createDoctor = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Creating new doctor');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Extract doctor data from request body
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      specialization, 
      experience, 
      bio, 
      availability,
      locationPreference,
      clinicAddress,
      appointmentDuration,
      profileImage 
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password || !specialization) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Check if doctor with email already exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ message: 'A doctor with this email already exists' });
    }
    
    // Validate availability format if provided
    if (availability && Array.isArray(availability)) {
      // Check each availability string follows the format "Day startHour-endHour"
      for (const avail of availability) {
        if (typeof avail !== 'string') {
          return res.status(400).json({ 
            message: 'Invalid availability format. Each entry must be a string.',
            example: 'Monday 9-12'
          });
        }
        
        const parts = avail.split(' ');
        if (parts.length < 2) {
          return res.status(400).json({ 
            message: 'Invalid availability format. Format should be "Day startHour-endHour"',
            example: 'Monday 9-12'
          });
        }
        
        const day = parts[0];
        const timeRange = parts[1];
        
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!validDays.includes(day)) {
          return res.status(400).json({ 
            message: `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}` 
          });
        }
        
        if (!timeRange.includes('-')) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Format should be "startHour-endHour"',
            example: '9-12'
          });
        }
        
        const [startHourStr, endHourStr] = timeRange.split('-');
        const startHour = parseInt(startHourStr);
        const endHour = parseInt(endHourStr);
        
        // Validate that the values are actually numbers
        if (isNaN(startHour) || isNaN(endHour)) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Hours must be numbers.',
            example: '9-12',
            received: timeRange
          });
        }
        
        if (startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24) {
          return res.status(400).json({ 
            message: 'Invalid hours in time range. Hours must be between 0-23.',
            example: '9-12'
          });
        }
        
        if (startHour >= endHour) {
          return res.status(400).json({ 
            message: 'Start hour must be before end hour',
            example: '9-12'
          });
        }
      }
    }
    
    // Create new doctor with all the provided fields
    const doctorData: Partial<IDoctor> = {
      firstName,
      lastName,
      email,
      password,
      specialization,
      experience: experience || 0,
      bio: bio || '',
      availability: availability || [],
      locationPreference: locationPreference || 'clinic',
      clinicAddress: clinicAddress || '',
      appointmentDuration: appointmentDuration || 30,
      isActive: true
    };
    
    console.log(`Creating new doctor with email: ${email}`);
    
    // Handle profile image if provided
    if (profileImage && typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(profileImage);
        doctorData.profileImage = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
      } catch (imageError) {
        console.error('Error uploading profile image:', imageError);
        // Continue with doctor creation even if image upload fails
      }
    }
    
    const newDoctor = new Doctor(doctorData);
    await newDoctor.save();
    
    // Remove password from response
    const doctorResponse = newDoctor.toObject();
    const { password: _, ...doctorWithoutPassword } = doctorResponse;
    
    console.log(`Doctor created successfully with ID: ${newDoctor._id}`);
    res.status(201).json(doctorWithoutPassword);
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get all doctors
 * @route GET /api/admin/doctors
 */
export const getAllDoctors = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Fetching all doctors');
    const doctors = await Doctor.find().select('-password');
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get doctor by ID
 * @route GET /api/admin/doctors/:id
 */
export const getDoctorById = async (req: AuthRequest, res: Response) => {
  try {
    console.log(`Fetching doctor by ID: ${req.params.id}`);
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
};

/**
 * Update doctor
 * @route PUT /api/admin/doctors/:id
 */
export const updateDoctor = async (req: AuthRequest, res: Response) => {
  try {
    console.log(`Updating doctor with ID: ${req.params.id}`);
    const doctorId = req.params.id;
    
    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Extract fields to update
    const {
      firstName,
      lastName,
      email,
      specialization,
      experience,
      bio,
      availability,
      locationPreference,
      clinicAddress,
      appointmentDuration,
      isActive,
      profileImage
    } = req.body;
    
    // Prepare update object
    const updates: Partial<IDoctor> = {};
    
    // Add fields that are present in the request
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) {
      // Check if the email is changing and if the new email is already in use
      if (email !== doctor.email) {
        const existingDoctor = await Doctor.findOne({ email });
        if (existingDoctor) {
          return res.status(400).json({ message: 'A doctor with this email already exists' });
        }
        updates.email = email;
      }
    }
    if (specialization !== undefined) updates.specialization = specialization;
    if (experience !== undefined) updates.experience = experience;
    if (bio !== undefined) updates.bio = bio;
    if (availability !== undefined) updates.availability = availability;
    if (locationPreference !== undefined) updates.locationPreference = locationPreference;
    if (clinicAddress !== undefined) updates.clinicAddress = clinicAddress;
    if (appointmentDuration !== undefined) updates.appointmentDuration = appointmentDuration;
    if (isActive !== undefined) updates.isActive = isActive;
    
    // Handle profile image update if provided
    if (profileImage && typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(profileImage);
        updates.profileImage = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
      } catch (imageError) {
        console.error('Error uploading profile image:', imageError);
        // Continue with doctor update even if image upload fails
      }
    }
    
    // Update the doctor
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log(`Doctor updated successfully: ${updatedDoctor?._id}`);
    res.json(updatedDoctor);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete doctor
 * @route DELETE /api/admin/doctors/:id
 */
export const deleteDoctor = async (req: AuthRequest, res: Response) => {
  try {
    console.log(`Deleting doctor with ID: ${req.params.id}`);
    const doctorId = req.params.id;
    
    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Check if doctor has appointments
    const hasAppointments = await Appointment.exists({ doctor: doctorId });
    if (hasAppointments) {
      // Instead of deleting, mark as inactive
      await Doctor.findByIdAndUpdate(doctorId, { isActive: false });
      return res.json({ 
        message: 'Doctor has existing appointments and cannot be deleted. Marked as inactive instead.' 
      });
    }
    
    // If no appointments, delete the doctor
    await Doctor.findByIdAndDelete(doctorId);
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 
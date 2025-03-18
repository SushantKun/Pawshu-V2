import express, { Request, Response, RequestHandler } from 'express';
import Appointment, { IAppointment } from '../models/Appointment';
import { verifyToken, adminAuth, doctorAuth, AuthRequest } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private (User)
router.post('/', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { doctor, date, timeSlot, petName, petType, reason } = req.body;
    
    // Validate input
    if (!doctor || !date || !timeSlot || !petName || !petType || !reason) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Create new appointment
    const appointment = new Appointment({
      ...req.body,
      user: req.user._id,
      status: 'pending'
    });
    
    await appointment.save();
    console.log('Appointment created successfully:', appointment._id);
    
    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments
// @desc    Get all appointments for the logged-in user
// @access  Private (User)
router.get('/my-appointments', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const appointments = await Appointment.find({ user: req.user._id })
      .populate('doctor', 'firstName lastName specialization')
      .sort({ date: 1 });

    res.json(appointments);
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments/doctor
// @desc    Get all appointments for the logged-in doctor
// @access  Private (Doctor)
router.get('/doctor', doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/appointments/doctor - Fetching doctor appointments');
    console.log('Doctor ID:', req.user?._id);
    
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Doctor ID not found in token' });
    }

    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate('user', 'name email')
      .sort({ date: -1 });
    
    console.log(`Found ${appointments.length} appointments for doctor ${req.user._id}`);
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments/admin/all
// @desc    Get all appointments (admin only)
// @access  Private (Admin)
router.get('/all', verifyToken, adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const appointments = await Appointment.find()
      .populate('user', 'name email')
      .populate('doctor', 'firstName lastName specialization')
      .sort({ date: 1 });

    res.json(appointments);
  } catch (error) {
    console.error('Error fetching all appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments/:id
// @desc    Get appointment by ID
// @access  Private (User or Doctor)
router.get('/:id', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`GET /api/appointments/${req.params.id} - Fetching appointment by ID`);
    const appointment = await Appointment.findById(req.params.id)
      .populate('user', 'name email')
      .populate('doctor', 'firstName lastName specialization');
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check if the user is authorized to view this appointment
    if (
      !req.user?.isAdmin && 
      appointment.user.toString() !== req.user?._id.toString() && 
      appointment.doctor.toString() !== req.user?._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to view this appointment' });
    }
    
    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   PUT /api/appointments/:id/status
// @desc    Update appointment status
// @access  Private (Doctor or Admin)
router.put('/:id/status', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`PUT /api/appointments/${req.params.id}/status - Updating appointment status`);
    console.log('User:', JSON.stringify(req.user, null, 2));
    console.log('Request body:', req.body);
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      console.log(`Appointment with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if the user is a doctor or admin
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.isAdmin || req.user.role === 'admin';
    
    // For doctors, check if they're assigned to this appointment
    const appointmentDoctorId = appointment.doctor.toString();
    const userId = req.user._id.toString();
    const isAssignedDoctor = isDoctor && appointmentDoctorId === userId;
    
    console.log({
      appointmentDoctorId,
      userId,
      isDoctor,
      isAdmin,
      isAssignedDoctor,
      userRole: req.user.role
    });
    
    // Allow admin or the assigned doctor to update
    if (!isAdmin && !isAssignedDoctor) {
      console.log('User not authorized to update this appointment');
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }

    // Update status if provided
    if (req.body.status) {
      appointment.status = req.body.status;
    }
    
    // Update notes if provided
    if (req.body.notes) {
      appointment.notes = req.body.notes;
    }
    
    await appointment.save();
    console.log(`Appointment ${req.params.id} updated successfully`);

    res.json(appointment);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   DELETE /api/appointments/:id
// @desc    Cancel appointment
// @access  Private (User, Doctor, or Admin)
router.delete('/:id', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Only allow the user who created the appointment, the assigned doctor, or an admin to delete it
    if (!req.user.isAdmin && 
        appointment.user.toString() !== req.user._id.toString() && 
        appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this appointment' });
    }

    await appointment.deleteOne();
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

export default router; 
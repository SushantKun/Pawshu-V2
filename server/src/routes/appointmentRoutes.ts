import express, { Request, Response, RequestHandler } from 'express';
import Appointment, { IAppointment } from '../models/Appointment';
import { auth, adminAuth, doctorAuth, AuthRequest } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private (User)
router.post('/', auth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /api/appointments - Creating new appointment');
    const { doctor, date, timeSlot, petName, petType, reason } = req.body;
    
    // Validate input
    if (!doctor || !date || !timeSlot || !petName || !petType || !reason) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Create new appointment
    const appointment = new Appointment({
      user: req.user?.id,
      doctor,
      date,
      timeSlot,
      petName,
      petType,
      reason,
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
router.get('/', auth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/appointments - Fetching user appointments');
    const appointments = await Appointment.find({ user: req.user?.id })
      .populate('doctor', 'firstName lastName specialization')
      .sort({ date: -1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments/doctor
// @desc    Get all appointments for the logged-in doctor
// @access  Private (Doctor)
router.get('/doctor', doctorAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/appointments/doctor - Fetching doctor appointments');
    const appointments = await Appointment.find({ doctor: req.user?.id })
      .populate('user', 'name email')
      .sort({ date: -1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments/admin/all
// @desc    Get all appointments (admin only)
// @access  Private (Admin)
router.get('/admin/all', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/appointments/admin/all - Fetching all appointments');
    const appointments = await Appointment.find()
      .populate('user', 'name email')
      .populate('doctor', 'firstName lastName specialization')
      .sort({ date: -1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching all appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments/:id
// @desc    Get appointment by ID
// @access  Private (User or Doctor)
router.get('/:id', auth as RequestHandler, (async (req: AuthRequest, res: Response) => {
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
      req.user?.role !== 'admin' && 
      appointment.user.toString() !== req.user?.id && 
      appointment.doctor.toString() !== req.user?.id
    ) {
      return res.status(403).json({ message: 'Not authorized to view this appointment' });
    }
    
    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   PUT /api/appointments/:id
// @desc    Update appointment status
// @access  Private (Doctor or Admin)
router.put('/:id', auth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`PUT /api/appointments/${req.params.id} - Updating appointment`);
    const { status, notes } = req.body;
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check if the user is authorized to update this appointment
    if (
      req.user?.role !== 'admin' && 
      appointment.doctor.toString() !== req.user?.id
    ) {
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }
    
    // Update fields
    if (status) appointment.status = status;
    if (notes) appointment.notes = notes;
    
    await appointment.save();
    console.log('Appointment updated successfully:', appointment._id);
    
    res.json(appointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   DELETE /api/appointments/:id
// @desc    Cancel appointment
// @access  Private (User, Doctor, or Admin)
router.delete('/:id', auth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`DELETE /api/appointments/${req.params.id} - Cancelling appointment`);
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check if the user is authorized to cancel this appointment
    if (
      req.user?.role !== 'admin' && 
      appointment.user.toString() !== req.user?.id && 
      appointment.doctor.toString() !== req.user?.id
    ) {
      return res.status(403).json({ message: 'Not authorized to cancel this appointment' });
    }
    
    // Update status to cancelled instead of deleting
    appointment.status = 'cancelled';
    await appointment.save();
    
    console.log('Appointment cancelled successfully:', appointment._id);
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

export default router; 
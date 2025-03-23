import express, { Request, Response, RequestHandler } from 'express';
import Appointment, { IAppointment } from '../models/Appointment';
import { verifyToken, adminAuth, doctorAuth, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private (User)
router.post('/', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { 
      doctor, 
      date, 
      timeSlot, 
      petName, 
      petType, 
      reason, 
      locationPreference,
      address,
      appointmentDuration 
    } = req.body;
    
    // Validate input
    if (!doctor || !date || !timeSlot || !petName || !petType || !reason || !locationPreference) {
      return res.status(400).json({ 
        message: 'Please provide all required fields',
        requiredFields: ['doctor', 'date', 'timeSlot', 'petName', 'petType', 'reason', 'locationPreference']
      });
    }
    
    // For home visits, address is required
    if (locationPreference === 'home_visit' && !address) {
      return res.status(400).json({ message: 'Address is required for home visits' });
    }

    // Check if the doctor exists and is active
    const doctorObj = await mongoose.model('Doctor').findById(doctor);
    if (!doctorObj) {
      return res.status(400).json({ message: 'Doctor not found' });
    }
    
    if (!doctorObj.isActive) {
      return res.status(400).json({ message: 'This doctor is currently not available for booking' });
    }
    
    // Check if doctor supports selected location preference
    if (
      (locationPreference === 'clinic' && doctorObj.locationPreference === 'home_visit') || 
      (locationPreference === 'home_visit' && doctorObj.locationPreference === 'clinic')
    ) {
      return res.status(400).json({ 
        message: `This doctor doesn't provide ${locationPreference} appointments. Available options: ${doctorObj.locationPreference}`
      });
    }
    
    // Check if the time slot is available
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    const nextDay = new Date(appointmentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const existingAppointment = await Appointment.findOne({
      doctor,
      date: {
        $gte: appointmentDate,
        $lt: nextDay
      },
      timeSlot,
      status: { $nin: ['cancelled'] } // Exclude cancelled appointments
    });
    
    if (existingAppointment) {
      return res.status(400).json({ 
        message: 'This time slot is already booked. Please select another time slot.' 
      });
    }
    
    // Set booking fee based on the doctor's specialization or a default amount
    // In a real app, you might have different fees for different doctors or specializations
    const bookingFee = 500; // Default booking fee in NPR
    
    // Create new appointment
    const appointment = new Appointment({
      user: req.user._id,
      doctor,
      date,
      timeSlot,
      petName,
      petType,
      reason,
      status: 'pending',
      locationPreference,
      address: locationPreference === 'home_visit' ? address : undefined,
      appointmentDuration: appointmentDuration || doctorObj.appointmentDuration || 30, // Use provided duration, doctor's setting, or default
      payment: {
        status: 'pending',
        amount: bookingFee
      }
    });
    
    await appointment.save();
    console.log('Appointment created successfully:', appointment._id);
    
    res.status(201).json({
      appointment,
      paymentRequired: true,
      bookingFee
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// @route   GET /api/appointments
// @desc    Get all appointments for the logged-in user
// @access  Private (User)
router.get('/my-appointments', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Determine if user is a doctor or admin to adjust query
    const isDoctor = req.user.isDoctor;
    const isAdmin = req.user.isAdmin;

    let appointments;
    
    if (isAdmin) {
      // Admin can see all appointments
      appointments = await Appointment.find()
        .sort({ date: -1, time: -1 })
        .populate('user', 'firstName lastName email phone')
        .populate('doctor', 'firstName lastName specialization');
    } else if (isDoctor) {
      // Doctor can see their own appointments
      appointments = await Appointment.find({ doctor: req.user._id })
        .sort({ date: -1, time: -1 })
        .populate('user', 'firstName lastName email phone');
    } else {
      // Regular user can see their own appointments
      appointments = await Appointment.find({ user: req.user._id })
        .sort({ date: -1, time: -1 })
        .populate('doctor', 'firstName lastName specialization');
    }

    res.json({
      appointments,
      userType: isDoctor ? 'doctor' : isAdmin ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
});

// @route   GET /api/appointments/doctor
// @desc    Get all appointments for the logged-in doctor
// @access  Private (Doctor)
router.get('/doctor', doctorAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/appointments/doctor - Fetching doctor appointments');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    console.log(`Finding appointments for doctor: ${req.user._id}`);
    
    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate('user', 'name email')
      .sort({ date: 1 });

    console.log(`Found ${appointments.length} appointments for doctor ${req.user._id}`);
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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
    const isDoctor = req.user.isDoctor;
    const isAdmin = req.user.isAdmin;
    
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
      userType: isDoctor ? 'doctor' : isAdmin ? 'admin' : 'user'
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

// @route   PUT /api/appointments/:id/payment
// @desc    Update appointment payment status
// @access  Private (User, Admin)
router.put('/:id/payment', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`PUT /api/appointments/${req.params.id}/payment - Updating payment status`);
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Only allow the user who created the appointment or an admin to update payment
    const isAdmin = req.user.isAdmin;
    const isAppointmentOwner = appointment.user.toString() === req.user._id.toString();
    
    if (!isAdmin && !isAppointmentOwner) {
      return res.status(403).json({ message: 'Not authorized to update payment for this appointment' });
    }

    const { status, method, transactionId } = req.body;
    
    // Validate input
    if (!status || !method) {
      return res.status(400).json({ 
        message: 'Please provide payment status and method',
        requiredFields: ['status', 'method']
      });
    }
    
    // Validate status
    if (!['pending', 'paid', 'refunded'].includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid payment status. Must be one of: pending, paid, refunded'
      });
    }
    
    // Validate method
    if (!['cash', 'card', 'khalti', 'esewa'].includes(method)) {
      return res.status(400).json({ 
        message: 'Invalid payment method. Must be one of: cash, card, khalti, esewa'
      });
    }
    
    // Update payment information
    appointment.payment.status = status;
    appointment.payment.method = method;
    
    if (transactionId) {
      appointment.payment.transactionId = transactionId;
    }
    
    // If status is paid, set the paidAt date
    if (status === 'paid') {
      appointment.payment.paidAt = new Date();
    }
    
    await appointment.save();
    console.log(`Payment for appointment ${req.params.id} updated successfully`);

    res.json({
      message: 'Payment updated successfully',
      appointment
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

export default router; 
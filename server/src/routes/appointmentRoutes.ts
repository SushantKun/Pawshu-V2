import express, { Request, Response, RequestHandler } from 'express';
import Appointment, { IAppointment } from '../models/Appointment';
import { verifyToken, adminAuth, doctorAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import { Types } from 'mongoose';
import { sendEmail } from '../utils/email';

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
    
    // Set booking fee based on the doctor's configured fee or default to 500 NPR
    const bookingFee = doctorObj.bookingFee || 500;
    
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
      .populate('user', 'firstName lastName email name')
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
// @access  Private (User if creator, Doctor if assigned, Admin)
router.put('/:id/status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const appointmentId = req.params.id;
    const { status, notes, cancellationReason, doctorId } = req.body;
    
    // Log the incoming request for troubleshooting
    console.log(`Status update request for appointment ${appointmentId}:`, {
      requestUser: req.user._id.toString(),
      requestRole: req.user.role || 'unknown',
      isDoctor: req.user.isDoctor || false,
      requestBody: req.body
    });
    
    // Validate status
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName _id')
      .populate('user', 'firstName lastName email');
      
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Type the populated fields correctly to avoid TypeScript errors
    const populatedDoctor = appointment.doctor as unknown as { 
      _id: Types.ObjectId;
      firstName: string;
      lastName: string;
    };
    
    const populatedUser = appointment.user as unknown as {
      _id: Types.ObjectId;
      firstName: string;
      lastName: string;
      email: string;
    };
    
    // Extract doctor ID string for comparison
    const appointmentDoctorId = populatedDoctor._id.toString();
    const requestUserId = req.user._id.toString();
    
    // Check authorization in different ways to be more permissive
    const isAdmin = req.user.isAdmin || false;
    const isPatient = populatedUser._id.toString() === requestUserId;
    
    // FIXED: Check all possible ways a doctor could be identified
    const isAssignedDoctor = (
      // Check if user has role property set to doctor and matches the appointment's doctor
      (req.user.role === 'doctor' && appointmentDoctorId === requestUserId) ||
      // Check if user has isDoctor flag set to true and matches the appointment's doctor
      (req.user.isDoctor === true && appointmentDoctorId === requestUserId) ||
      // Check if doctorId was explicitly provided in the request and matches the appointment's doctor
      (doctorId && appointmentDoctorId === doctorId)
    );
    
    // Log the authorization check results
    console.log('Authorization checks for appointment update:', {
      appointmentId,
      appointmentDoctorId,
      requestUserId,
      userRole: req.user.role || 'unknown',
      isDoctor: req.user.isDoctor || false,
      providedDoctorId: doctorId || 'none',
      authResults: {
        isAdmin,
        isPatient,
        isAssignedDoctor
      },
      action: `Update status to ${status}`
    });
    
    // Only the assigned doctor can mark an appointment as completed
    if (status === 'completed' && !isAssignedDoctor && !isAdmin) {
      console.log(`Permission denied: User ${requestUserId} attempted to complete appointment ${appointmentId} assigned to doctor ${appointmentDoctorId}`);
      return res.status(403).json({ 
        message: 'Only the assigned doctor can mark an appointment as completed',
        debug: {
          userIsDoctor: req.user.isDoctor || false,
          appointmentDoctor: appointmentDoctorId,
          requestUser: requestUserId,
          match: appointmentDoctorId === requestUserId
        }
      });
    }
    
    // For other status changes, validate based on role
    if (!isAdmin && !isPatient && !isAssignedDoctor) {
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }
    
    // Handle specific status change logic
    if (status === 'cancelled' && cancellationReason) {
      appointment.cancellationReason = cancellationReason;
    }
    
    // Update appointment status
    appointment.status = status;
    
    // Add notes if provided
    if (notes !== undefined) {
      appointment.notes = notes;
    }
    
    const updatedAppointment = await appointment.save();
    console.log(`Successfully updated appointment ${appointmentId} status to ${status}`);
    
    // Send notification for status change
    try {
      // Email to patient
      if (populatedUser.email) {
        let subject = 'Appointment Status Update';
        let message = `Your appointment with Dr. ${populatedDoctor.firstName} ${populatedDoctor.lastName} has been updated to ${status}.`;
        
        // Custom message based on status
        if (status === 'confirmed') {
          subject = 'Appointment Confirmed';
          message = `Your appointment with Dr. ${populatedDoctor.firstName} ${populatedDoctor.lastName} has been confirmed. Please arrive 10 minutes before your scheduled time.`;
          console.log("DOCTOR ACCEPTED APPOINTMENT NOTIFICATION would be sent to user:", populatedUser.email);
        } else if (status === 'completed') {
          subject = 'Appointment Completed';
          message = `Your appointment with Dr. ${populatedDoctor.firstName} ${populatedDoctor.lastName} has been marked as completed. Thank you for using our service.`;
        } else if (status === 'cancelled') {
          subject = 'Appointment Cancelled';
          message = `Your appointment with Dr. ${populatedDoctor.firstName} ${populatedDoctor.lastName} has been cancelled.`;
          if (cancellationReason) {
            message += ` Reason: ${cancellationReason}`;
          }
        }
        
        // Call the email service with the updated interface
        console.log(`Notification logging (email will be sent in future implementation):`);
        await sendEmail({
          to: populatedUser.email,
          subject: subject,
          text: message
        });
      }
    } catch (emailError) {
      console.error('Failed to send notification:', emailError);
      // Don't fail the request if notification fails
    }
    
    res.status(200).json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
// @access  Private (User, Admin, Doctor)
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

    // Allow the user who created the appointment, the assigned doctor, or an admin to update payment
    const isAdmin = req.user.isAdmin;
    const isAppointmentOwner = appointment.user.toString() === req.user._id.toString();
    const isAssignedDoctor = req.user.isDoctor && appointment.doctor.toString() === req.user._id.toString();
    
    if (!isAdmin && !isAppointmentOwner && !isAssignedDoctor) {
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

// @route   PUT /api/appointments/:id/notes
// @desc    Update appointment notes
// @access  Private (Doctor if assigned, Admin)
router.put('/:id/notes', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const appointmentId = req.params.id;
    const { notes } = req.body;
    
    if (!notes && notes !== '') {
      return res.status(400).json({ message: 'Notes field is required' });
    }
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName _id')
      .populate('user', 'firstName lastName email');
      
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Type the populated fields correctly to avoid TypeScript errors
    const populatedDoctor = appointment.doctor as unknown as { 
      _id: Types.ObjectId;
      firstName: string;
      lastName: string;
    };
    
    const appointmentDoctorId = populatedDoctor._id.toString();
    const requestUserId = req.user._id.toString();
    const isAdmin = req.user.isAdmin || false;
    
    // Check permissions - only doctor assigned to appointment or admin can add notes
    if (!isAdmin && appointmentDoctorId !== requestUserId) {
      return res.status(403).json({ 
        message: 'Not authorized to update notes for this appointment'
      });
    }
    
    // Update notes
    appointment.notes = notes;
    
    const updatedAppointment = await appointment.save();
    console.log(`Successfully updated notes for appointment ${appointmentId}`);
    
    res.status(200).json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment notes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// eSewa payment initiation for appointments
router.post('/esewa-payment', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Initiating eSewa appointment payment with data:', JSON.stringify(req.body, null, 2));
    
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { appointmentId, amount } = req.body;
    
    if (!appointmentId || !amount) {
      console.error('Missing required fields in eSewa initiation request:', req.body);
      res.status(400).json({ message: 'Missing required fields: appointmentId, amount' });
      return;
    }

    // Validate amount is a valid number
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error('Invalid amount value in eSewa initiation request:', amount);
      res.status(400).json({ message: 'Amount must be a positive number' });
      return;
    }

    // Verify the appointment exists and belongs to this user
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.error('Appointment not found for eSewa payment:', appointmentId);
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    if (appointment.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      console.error('Access denied for eSewa payment: Appointment does not belong to user');
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Ensure appointment has payment information
    if (!appointment.payment) {
      console.error('Appointment has no payment information:', appointmentId);
      res.status(400).json({ message: 'Appointment payment information is missing' });
      return;
    }

    // Server URL configuration with validation
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    
    console.log('Using URLs for eSewa payment:', { clientUrl, serverUrl });

    // Create eSewa payment request payload with strict formatting
    const formattedAmount = numericAmount.toFixed(2); // Ensure amount has 2 decimal places
    const signatureMessage = `total_amount=${formattedAmount},transaction_uuid=${appointmentId},product_code=EPAYTEST`;
    const signature = createEsewaSignature(signatureMessage);
    
    console.log('Appointment payment request signature message:', signatureMessage);
    console.log('Appointment payment request signature:', signature);

    // Build complete URLs with meaningful parameters
    const successUrl = `${clientUrl}/profile?status=success&appointmentId=${appointmentId}`;
    const failureUrl = `${clientUrl}/profile?status=failed&reason=payment_cancelled&appointmentId=${appointmentId}`;

    const formData = {
      amount: formattedAmount,
      failure_url: failureUrl,
      product_delivery_charge: "0",
      product_service_charge: "0",
      product_code: "EPAYTEST",
      signature: signature,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      success_url: successUrl,
      tax_amount: "0",
      total_amount: formattedAmount,
      transaction_uuid: appointmentId,
    };

    console.log('Generated eSewa appointment formData:', JSON.stringify(formData, null, 2));
    console.log('Expected callback URLs:', { 
      success: successUrl,
      failure: failureUrl
    });

    // Save the transaction attempt in the appointment's payment information
    appointment.payment.method = 'esewa';
    appointment.payment.status = 'pending';
    await appointment.save();
    
    // Return the form data to be submitted client-side
    res.json({
      message: 'eSewa appointment payment initiated',
      payment_method: 'esewa',
      formData
    });
  } catch (error) {
    console.error('Error initiating eSewa appointment payment:', error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

// Create eSewa payment signature
const createEsewaSignature = (message: string): string => {
  const secret = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q"; // Test mode secret key
  
  // Log the inputs for debugging
  console.log('Creating appointment signature with:', { message, secret });
  
  // Use the correct HMAC algorithm and encoding
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  const signature = hmac.digest("base64");
  
  console.log('Generated appointment signature:', signature);
  return signature;
};

// eSewa payment success callback handler
router.post('/esewa/verify', async (req: Request, res: Response) => {
  try {
    console.log('eSewa appointment verification request received:', req.body);
    
    const { oid, amt, refId } = req.body;
    
    // Enhanced validation to check both missing fields and empty values
    if (!oid || !amt || !refId || oid === '' || amt === '' || refId === '') {
      console.error('Missing or empty required fields in eSewa verification:', { oid, amt, refId });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Find and update the appointment payment
    const appointment = await Appointment.findById(oid);
    if (!appointment) {
      console.error('Appointment not found in eSewa verification:', oid);
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if the appointment has payment information
    if (!appointment.payment) {
      console.error('Appointment has no payment information:', oid);
      return res.status(400).json({
        success: false,
        message: 'No payment information found'
      });
    }

    // Check if payment is already marked as paid
    if (appointment.payment.status === 'paid') {
      console.log('Payment already marked as paid for appointment:', oid);
      return res.json({
        success: true,
        message: 'Payment already verified',
        appointment
      });
    }
    
    // Update payment information
    appointment.payment.status = 'paid';
    appointment.payment.method = 'esewa';
    appointment.payment.transactionId = refId;
    appointment.payment.paidAt = new Date();
    
    await appointment.save();
    console.log(`Successfully processed eSewa payment for appointment ${oid}`);
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      appointment
    });
  } catch (error) {
    console.error('Error processing eSewa verification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payment verification'
    });
  }
});

// Initiate Khalti payment for appointments
router.post('/khalti-payment', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, amount, returnUrl } = req.body;
    
    console.log('Initiating Khalti appointment payment with data:', JSON.stringify(req.body, null, 2));
    
    if (!appointmentId || !amount) {
      res.status(400).json({ message: 'Please provide appointment ID and amount' });
      return;
    }

    // Find appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    // Convert amount to paisa (Khalti requires amount in paisa)
    const amountInPaisa = Math.round(parseFloat(amount.toString()) * 100);
    
    // Get client URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const redirectUrl = returnUrl || `${clientUrl}/profile`;
    
    // Create Khalti payment request payload
    const khaltiPayload = {
      return_url: `${redirectUrl}?status=success&pidx=${appointmentId}`,
      website_url: clientUrl,
      amount: amountInPaisa,
      purchase_order_id: `appointment_${appointmentId}`,
      purchase_order_name: `Payment for Appointment`,
      customer_info: {
        name: `${req.user?.firstName} ${req.user?.lastName}`,
        email: req.user?.email,
        phone: req.user?.phone || ''
      }
    };
    
    // Get Khalti API Key from environment variables
    const khaltiApiKey = process.env.KHALTI_SECRET_KEY;
    
    if (!khaltiApiKey) {
      console.error('Khalti API key not configured');
      res.status(500).json({ message: 'Payment gateway not properly configured' });
      return;
    }
    
    // Make request to Khalti API
    const khaltiResponse = await axios.post(
      'https://dev.khalti.com/api/v2/epayment/initiate/',
      khaltiPayload,
      {
        headers: {
          'Authorization': `Key ${khaltiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Khalti appointment payment initiation response:', khaltiResponse.data);
    
    if (khaltiResponse.data && khaltiResponse.data.payment_url) {
      // Return payment URL to client
      res.json({
        message: 'Khalti appointment payment initiated',
        paymentUrl: khaltiResponse.data.payment_url,
        pidx: khaltiResponse.data.pidx
      });
    } else {
      console.error('Khalti API error:', khaltiResponse.data);
      res.status(500).json({ message: 'Error initiating payment with Khalti' });
    }
  } catch (error) {
    console.error('Error initiating Khalti appointment payment:', error);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

// Verify Khalti Payment Status
router.post('/khalti-verify', async (req: Request, res: Response) => {
  try {
    const { pidx, appointment_id } = req.body;
    
    console.log('Khalti appointment verification request received:', { pidx, appointment_id });
    
    if (!pidx) {
      console.error('Missing payment identifier (pidx)');
      res.status(400).json({ message: 'Missing payment identifier', status: 'Failed' });
      return;
    }
    
    // Get Khalti API Key from environment variables
    const khaltiApiKey = process.env.KHALTI_SECRET_KEY;
    
    if (!khaltiApiKey) {
      console.error('Khalti API key not configured');
      res.status(500).json({ message: 'Payment gateway not properly configured', status: 'Failed' });
      return;
    }
    
    // Find the appointment if ID is provided
    let appointment = null;
    if (appointment_id) {
      appointment = await Appointment.findById(appointment_id);
      if (!appointment) {
        console.error(`Appointment not found: ${appointment_id}`);
        res.status(404).json({ message: 'Appointment not found', status: 'Failed' });
        return;
      }
    }
    
    // Make lookup request to Khalti API
    try {
      console.log(`Making Khalti API lookup request for pidx: ${pidx}`);
      const khaltiResponse = await axios.post(
        'https://dev.khalti.com/api/v2/epayment/lookup/',
        { pidx },
        {
          headers: {
            'Authorization': `Key ${khaltiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Khalti appointment payment verification response:', khaltiResponse.data);
      
      if (khaltiResponse.data && khaltiResponse.data.status === 'Completed') {
        // Update appointment payment if successful
        if (appointment) {
          console.log(`Updating appointment ${appointment_id} payment status to paid`);
          // Use type assertion to resolve TypeScript error
          const appointmentDoc = appointment as unknown as {
            payment: {
              status: string;
              method: string;
              transactionId: string;
              paidAt: Date;
            };
            save: () => Promise<any>;
          };
          
          appointmentDoc.payment.status = 'paid';
          appointmentDoc.payment.method = 'khalti';
          appointmentDoc.payment.transactionId = pidx;
          appointmentDoc.payment.paidAt = new Date();
          await appointmentDoc.save();
          
          console.log(`Successfully verified Khalti payment for appointment ${appointment_id}`);
        } 
        // We'll handle only direct appointment verification for now
        // Support for purchase_order_id extraction can be added later
        
        res.json({
          status: 'Complete',
          message: 'Payment verified successfully'
        });
      } else {
        console.warn(`Khalti payment verification failed. Status: ${khaltiResponse.data.status}`);
        res.json({
          status: 'Failed',
          message: 'Payment verification failed'
        });
      }
    } catch (apiError) {
      console.error('Error making Khalti API request:', apiError);
      res.status(500).json({ 
        message: 'Failed to verify payment with Khalti',
        status: 'Failed',
        error: apiError.message
      });
    }
  } catch (error) {
    console.error('Error verifying Khalti appointment payment:', error);
    res.status(500).json({ 
      message: 'Failed to verify payment',
      status: 'Failed',
      error: error.message
    });
  }
});

// Manual payment verification endpoint
router.post('/manual-verify', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, method = 'esewa' } = req.body;
    
    console.log('Manual payment verification request:', { appointmentId, method });
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    if (!appointmentId) {
      return res.status(400).json({ message: 'Missing appointment ID' });
    }
    
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check if payment is already marked as paid
    if (appointment.payment?.status === 'paid') {
      console.log('Payment already marked as paid for appointment:', appointmentId);
      return res.json({
        status: 'Complete',
        message: 'Payment already verified',
        appointment
      });
    }
    
    // Update payment information
    if (!appointment.payment) {
      appointment.payment = {
        status: 'paid',
        method: method,
        amount: 0,
        transactionId: `manual-${Date.now()}`,
        paidAt: new Date()
      };
    } else {
      appointment.payment.status = 'paid';
      appointment.payment.method = method;
      appointment.payment.transactionId = `manual-${Date.now()}`;
      appointment.payment.paidAt = new Date();
    }
    
    await appointment.save();
    console.log(`Successfully verified payment for appointment ${appointmentId}`);
    
    res.json({
      status: 'Complete',
      message: 'Payment verified successfully',
      appointment
    });
  } catch (error) {
    console.error('Error manually verifying payment:', error);
    res.status(500).json({ 
      status: 'Failed',
      message: 'Failed to verify payment' 
    });
  }
});

export default router; 
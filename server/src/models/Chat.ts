import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  _id?: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface IChat extends Document {
  participants: mongoose.Types.ObjectId[];
  messages: IMessage[];
  context: {
    type: 'lost-found' | 'appointment';
    referenceId: mongoose.Types.ObjectId;
  };
  lastMessage: {
    content: string;
    timestamp: Date;
    sender: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

const chatSchema = new Schema<IChat>({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [messageSchema],
  context: {
    type: {
      type: String,
      enum: ['lost-found', 'appointment'],
      required: true
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'context.type' // Dynamic reference based on context type
    }
  },
  lastMessage: {
    content: String,
    timestamp: Date,
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
chatSchema.index({ participants: 1 });
chatSchema.index({ 'context.type': 1, 'context.referenceId': 1 });
chatSchema.index({ 'lastMessage.timestamp': -1 });

const Chat = mongoose.model<IChat>('Chat', chatSchema);

export default Chat; 
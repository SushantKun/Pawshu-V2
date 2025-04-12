import mongoose, { Document, Schema, Model } from 'mongoose';

// Define interface for Charity document with method
export interface ICharity extends Document {
  name: string;
  description: string;
  goal: number;
  raised: number;
  updatedAt: Date;
  image?: {
    public_id: string;
    url: string;
  };
  refreshRaisedAmount: () => Promise<number>;
}

interface ImageObject {
  public_id: string;
  url: string;
}

const charitySchema = new Schema({
  name: {
    type: String,
    required: [true, 'Charity name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Charity description is required'],
    trim: true
  },
  image: {
    public_id: String,
    url: String
  },
  goal: {
    type: Number,
    required: [true, 'Charity goal amount is required'],
    min: [0, 'Goal amount cannot be negative']
  },
  raised: {
    type: Number,
    default: 0,
    min: [0, 'Raised amount cannot be negative']
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add a method to update raised amount
charitySchema.methods.updateRaisedAmount = async function() {
  const Donation = mongoose.model('Donation');
  const totalRaised = await Donation.aggregate([
    {
      $match: {
        charityId: this._id,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  this.raised = totalRaised[0]?.total || 0;
  await this.save();
  return this.raised;
};

// Add a pre-save hook to ensure raised amount doesn't exceed goal
charitySchema.pre('save', function(next) {
  if (this.raised > this.goal) {
    this.raised = this.goal;
  }
  next();
});

// Add a method to update raised amount based on current donations
charitySchema.methods.refreshRaisedAmount = async function(this: ICharity) {
  try {
    const Donation = mongoose.model('Donation');
    const totalRaised = await Donation.aggregate([
      {
        $match: {
          charityId: this._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    console.log(`Refreshing charity ${this._id} raised amount:`, totalRaised[0]?.total || 0);
    this.raised = totalRaised[0]?.total || 0;
    await this.save();
    return this.raised;
  } catch (error) {
    console.error('Error refreshing charity raised amount:', error);
    return this.raised;
  }
};

// Create Charity model with ICharity interface
export const Charity: Model<ICharity> = mongoose.model<ICharity>('Charity', charitySchema);

// Initial charities data
export const initialCharities = [
  {
    name: "Nepal Animal Shelter",
    description: "Supporting stray animals with food, shelter, and medical care. Your donation helps us provide essential care for abandoned pets.",
    image: {
      public_id: "charity_placeholder",
      url: "https://placehold.co/300x300"
    },
    goal: 50000,
    raised: 0
  },
  {
    name: "Street Dog Welfare",
    description: "Providing vaccinations and medical treatment for street dogs. Help us create a healthier environment for street animals.",
    image: {
      public_id: "charity_placeholder",
      url: "https://placehold.co/300x300"
    },
    goal: 25000,
    raised: 0
  },
  {
    name: "Cat Shelter",
    description: "Meoww!",
    image: {
      public_id: "charity_placeholder",
      url: "https://placehold.co/300x300"
    },
    goal: 20000,
    raised: 0
  }
]; 
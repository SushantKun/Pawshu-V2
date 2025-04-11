import mongoose from 'mongoose';

interface ImageObject {
  public_id: string;
  url: string;
}

const charitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  },
  goal: {
    type: Number,
    required: true,
    min: 0
  },
  raised: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value: number) {
        return value >= 0;
      },
      message: 'Raised amount cannot be negative'
    }
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

export const Charity = mongoose.model('Charity', charitySchema);

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
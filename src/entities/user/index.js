import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      required: true,
    },
    publicKey: {
      type: Buffer,
      required: true,
    },
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
    transports: [{ type: String }],
    label: {
      type: String,
      default: 'Unknown device',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const recoveryCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'username is required'],
      unique: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._\-]{3,25}$/,
        'username must be 3-25 characters, only letters, numbers, dots, underscores and hyphens',
      ],
    },
    role: {
      type: String,
      enum: { values: ['admin', 'user'], message: 'invalid role' },
      default: 'user',
    },
    credentials: [credentialSchema],
    recoveryCodes: [recoveryCodeSchema],
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

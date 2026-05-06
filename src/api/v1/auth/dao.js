import { User } from '../../../entities/user/index.js';

export const daoFindByUsername = async (username) => User.findOne({ username });

export const daoFindById = async (id) => User.findById(id);

export const daoCreateUser = async (data) => User.create(data);

export const daoAddCredential = async (userId, credential) =>
  User.findByIdAndUpdate(
    userId,
    { $push: { credentials: credential } },
    { returnDocument: 'after', runValidators: true },
  );

export const daoRemoveCredential = async (userId, credentialId) =>
  User.findByIdAndUpdate(
    userId,
    { $pull: { credentials: { _id: credentialId } } },
    { returnDocument: 'after' },
  );

export const daoUpdateCredentialCounter = async (userId, credentialId, counter) =>
  User.findByIdAndUpdate(
    userId,
    { $set: { 'credentials.$[elem].counter': counter } },
    { arrayFilters: [{ 'elem.credentialId': credentialId }] },
  );

export const daoMarkRecoveryCodeUsed = async (userId, index) =>
  User.findByIdAndUpdate(
    userId,
    { $set: { [`recoveryCodes.${index}.used`]: true } },
    { returnDocument: 'after' },
  );

export const daoReplaceRecoveryCodes = async (userId, codes) =>
  User.findByIdAndUpdate(
    userId,
    { $set: { recoveryCodes: codes } },
    { returnDocument: 'after' },
  );

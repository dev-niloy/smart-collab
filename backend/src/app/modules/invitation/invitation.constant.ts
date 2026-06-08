export const INVITATION_TTL_DAYS = 7;

export const ERR_INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND';
export const INVITATION_NOT_FOUND_MESSAGE = 'Invitation not found.';

export const ERR_INVITATION_EXPIRED = 'INVITATION_EXPIRED';
export const INVITATION_EXPIRED_MESSAGE = 'This invitation has expired.';

export const ERR_INVITATION_REVOKED = 'INVITATION_REVOKED';
export const INVITATION_REVOKED_MESSAGE = 'This invitation was revoked.';

export const ERR_INVITATION_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED';
export const INVITATION_ACCEPTED_MESSAGE = 'This invitation has already been accepted.';

export const ERR_INVITATION_EMAIL_MISMATCH = 'INVITATION_EMAIL_MISMATCH';
export const INVITATION_EMAIL_MISMATCH_MESSAGE =
  'You are signed in with a different email than the one this invitation was sent to.';

export const ERR_INVITATION_ALREADY_MEMBER = 'INVITATION_ALREADY_MEMBER';
export const INVITATION_ALREADY_MEMBER_MESSAGE =
  'This user is already a member of the project.';

export const ERR_INVITATION_PENDING_EXISTS = 'INVITATION_PENDING_EXISTS';
export const INVITATION_PENDING_EXISTS_MESSAGE =
  'A pending invitation for this email already exists. Revoke it first.';

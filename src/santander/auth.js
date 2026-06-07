// Floid uses a static API key (Bearer token), no OAuth needed.
// Get your API key from https://floid.io after creating an account.

function getFloidToken() {
  const token = process.env.FLOID_API_KEY;
  if (!token) throw new Error('FLOID_API_KEY not set. Add it to your .env file.');
  return token;
}

function getAuthHeader() {
  return { Authorization: `Bearer ${getFloidToken()}` };
}

module.exports = { getAuthHeader };

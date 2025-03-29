// Simple donation test script
// Run this in the browser console to test a donation

async function testDonation() {
  // Get token from local storage
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('No authentication token found. Please login first.');
    return;
  }
  
  // Donation data - update with a valid charity ID from your database
  const donationData = {
    charityId: "67d7194f50221845da605313", // Replace with a valid charity ID
    charityName: "Cat Shelter",
    amount: 2000,
    status: 'completed',
    paymentMethod: 'card'
  };
  
  console.log('Attempting to make a donation with data:', donationData);
  
  try {
    // Make the API call using fetch
    const response = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(donationData)
    });
    
    // Parse the response
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.message || 'Failed to process donation');
    }
    
    console.log('✅ Donation successful:', responseData);
    return responseData;
  } catch (error) {
    console.error('❌ Error making donation:', error);
    throw error;
  }
}

// Run the test and log the result
console.log('To test a donation, run the following in your console:');
console.log('testDonation().then(result => console.log("Success:", result)).catch(err => console.error("Error:", err))');

// This file is for testing purposes only
// To use it, copy and paste the testDonation function into your browser console
// Then call testDonation() to test the donation process 
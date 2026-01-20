// Test script to verify renewal detection logic
// This simulates the logic we added to prevent double credit allocation

function testRenewalDetection() {
  console.log('Testing renewal detection logic...\n')
  
  // Test Case 1: New subscription (should be initial payment)
  const newSubscription = {
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    status: 'active',
    payment_status: 'completed',
    cancelled_at: null
  }
  
  const subscriptionAge = Date.now() - new Date(newSubscription.created_at).getTime()
  const daysSinceCreation = subscriptionAge / (1000 * 60 * 60 * 24)
  
  const isRenewal1 = newSubscription.status === 'active' && 
                   newSubscription.payment_status === 'completed' &&
                   !newSubscription.cancelled_at &&
                   daysSinceCreation >= 25
  
  console.log('Test Case 1: New subscription (1 hour old)')
  console.log(`  Days since creation: ${daysSinceCreation.toFixed(4)}`)
  console.log(`  Is renewal: ${isRenewal1} (should be false)`)
  console.log(`  ✅ ${isRenewal1 === false ? 'PASS' : 'FAIL'}\n`)
  
  // Test Case 2: Old subscription (should be renewal)
  const oldSubscription = {
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    status: 'active',
    payment_status: 'completed',
    cancelled_at: null
  }
  
  const subscriptionAge2 = Date.now() - new Date(oldSubscription.created_at).getTime()
  const daysSinceCreation2 = subscriptionAge2 / (1000 * 60 * 60 * 24)
  
  const isRenewal2 = oldSubscription.status === 'active' && 
                   oldSubscription.payment_status === 'completed' &&
                   !oldSubscription.cancelled_at &&
                   daysSinceCreation2 >= 25
  
  console.log('Test Case 2: Old subscription (30 days old)')
  console.log(`  Days since creation: ${daysSinceCreation2.toFixed(4)}`)
  console.log(`  Is renewal: ${isRenewal2} (should be true)`)
  console.log(`  ✅ ${isRenewal2 === true ? 'PASS' : 'FAIL'}\n`)
  
  // Test Case 3: Cancelled subscription (should not be renewal)
  const cancelledSubscription = {
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    status: 'active',
    payment_status: 'completed',
    cancelled_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // cancelled 5 days ago
  }
  
  const subscriptionAge3 = Date.now() - new Date(cancelledSubscription.created_at).getTime()
  const daysSinceCreation3 = subscriptionAge3 / (1000 * 60 * 60 * 24)
  
  const isRenewal3 = cancelledSubscription.status === 'active' && 
                   cancelledSubscription.payment_status === 'completed' &&
                   !cancelledSubscription.cancelled_at &&
                   daysSinceCreation3 >= 25
  
  console.log('Test Case 3: Cancelled subscription (30 days old, cancelled 5 days ago)')
  console.log(`  Days since creation: ${daysSinceCreation3.toFixed(4)}`)
  console.log(`  Is renewal: ${isRenewal3} (should be false)`)
  console.log(`  ✅ ${isRenewal3 === false ? 'PASS' : 'FAIL'}\n`)
  
  // Test Case 4: Edge case - exactly 25 days (should be renewal)
  const edgeSubscription = {
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // exactly 25 days ago
    status: 'active',
    payment_status: 'completed',
    cancelled_at: null
  }
  
  const subscriptionAge4 = Date.now() - new Date(edgeSubscription.created_at).getTime()
  const daysSinceCreation4 = subscriptionAge4 / (1000 * 60 * 60 * 24)
  
  const isRenewal4 = edgeSubscription.status === 'active' && 
                   edgeSubscription.payment_status === 'completed' &&
                   !edgeSubscription.cancelled_at &&
                   daysSinceCreation4 >= 25
  
  console.log('Test Case 4: Edge case - exactly 25 days old')
  console.log(`  Days since creation: ${daysSinceCreation4.toFixed(4)}`)
  console.log(`  Is renewal: ${isRenewal4} (should be true)`)
  console.log(`  ✅ ${isRenewal4 === true ? 'PASS' : 'FAIL'}\n`)
  
  // Summary
  const allPassed = (isRenewal1 === false) && (isRenewal2 === true) && (isRenewal3 === false) && (isRenewal4 === true)
  console.log(`Overall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
  
  return allPassed
}

// Run the test
testRenewalDetection()

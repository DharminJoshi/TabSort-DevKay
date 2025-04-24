// Track tab activity by tab ID
let inactiveTabs = {};

// Store tab groups by user-defined categories (e.g., Work, Research)
let tabGroups = {};

// Function to check inactive tabs and close them after a certain time (10 minutes)
function checkInactiveTabs() {
  const currentTime = Date.now();
  for (const tabId in inactiveTabs) {
    if (currentTime - inactiveTabs[tabId] > 10 * 60 * 1000) { // 10 minutes
      chrome.tabs.remove(Number(tabId)); // Close the tab
      delete inactiveTabs[tabId]; // Remove from tracker
    }
  }
}

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(activeInfo => {
  inactiveTabs[activeInfo.tabId] = Date.now(); // Update timestamp for active tab
});

// Listen for tab updates (when a tab finishes loading)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    inactiveTabs[tabId] = Date.now(); // Update timestamp when tab is done loading
  }
});

// Periodically check for inactive tabs
setInterval(checkInactiveTabs, 60 * 1000); // Check every minute

// Listen for messages from popup.js (e.g., to group a tab)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'groupTab') {
    const tabId = message.tabId;
    const groupName = prompt("Enter group name (e.g., Work, Research):");

    // Create a group if it doesn't exist
    if (!tabGroups[groupName]) {
      tabGroups[groupName] = [];
    }

    // Add the tab to the specified group
    if (!tabGroups[groupName].includes(tabId)) {
      tabGroups[groupName].push(tabId);
    }
    alert(`Tab added to group: ${groupName}`);
  }

  if (message.action === 'closeInactiveTabs') {
    checkInactiveTabs(); // Close inactive tabs when button is clicked
  }
});

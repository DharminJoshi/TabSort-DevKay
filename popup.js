document.getElementById('closeInactiveTabs').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'closeInactiveTabs' });
  });
  
  // Display a list of open tabs in the popup
  chrome.tabs.query({}, function(tabs) {
    const tabsList = document.getElementById('tabsList');
    tabsList.innerHTML = ''; // Clear any previous list
  
    tabs.forEach(tab => {
      const tabItem = document.createElement('div');
      tabItem.classList.add('tab-item');
      tabItem.textContent = tab.title;
  
      // Add a button to group tabs
      const groupButton = document.createElement('button');
      groupButton.textContent = 'Group';
      groupButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          action: 'groupTab',
          tabId: tab.id
        });
      });
  
      tabItem.appendChild(groupButton);
      tabsList.appendChild(tabItem);
    });
  });
  
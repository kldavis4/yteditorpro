// Copyright 2016 Kelly Davis
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// GA4 Measurement Protocol configuration
let gaConfig = null;
let clientId = null;

// Initialize GA4 configuration
async function initGA() {
  if (gaConfig) return;

  try {
    const response = await fetch(chrome.runtime.getURL('settings.json'));
    gaConfig = await response.json();

    // Get or create a persistent client ID
    const stored = await chrome.storage.local.get('ga_client_id');
    if (stored.ga_client_id) {
      clientId = stored.ga_client_id;
    } else {
      clientId = crypto.randomUUID();
      await chrome.storage.local.set({ ga_client_id: clientId });
    }
  } catch (error) {
    console.error('Failed to initialize GA config:', error);
  }
}

// Send event to GA4 using Measurement Protocol
async function sendGA4Event(eventName, params = {}) {
  if (!gaConfig || !gaConfig.ga_measurement_id || !gaConfig.ga_api_secret) {
    console.warn('GA4 not configured');
    return;
  }

  if (gaConfig.ga_measurement_id === 'G-XXXXXXXXXX') {
    // Skip if using placeholder values
    return;
  }

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${gaConfig.ga_measurement_id}&api_secret=${gaConfig.ga_api_secret}`;

    await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        events: [{
          name: eventName,
          params: params
        }]
      })
    });
  } catch (error) {
    console.error('Failed to send GA4 event:', error);
  }
}

// Convert legacy _gaq format to GA4 event
function processLegacyEvent(event) {
  if (!Array.isArray(event) || event.length === 0) return;

  const action = event[0];

  if (action === '_trackPageview') {
    sendGA4Event('page_view', {
      page_location: 'youtube.com/editor'
    });
  } else if (action === '_trackEvent') {
    // Legacy format: ['_trackEvent', category, action, label, value]
    const category = event[1] || '';
    const eventAction = event[2] || '';
    const label = event[3] || '';
    const value = event[4];

    sendGA4Event('legacy_event', {
      event_category: category,
      event_action: eventAction,
      event_label: label,
      ...(value !== undefined && { value: value })
    });
  }
}

// Initialize on service worker start
initGA();

// Set the browser action button to open the YouTube video editor in a new window
chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.create({ 'url': 'https://www.youtube.com/editor' });
});

// Handle messages from content scripts (analytics events)
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.event) {
    processLegacyEvent(msg.event);
    sendResponse('Success');
  }
  return true; // Keep the message channel open for async response
});

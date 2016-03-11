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

//Google Analytics Setup
//
var _gaq = _gaq || [];

jQuery.getJSON('settings.json',function(settings) {
    _gaq.push(function() {
        _gaq.push(['_setAccount', settings.ga_tracker_id]);
    });

    (function() {
      var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
      ga.src = 'https://ssl.google-analytics.com/ga.js';
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
    })();
});

chrome.runtime.onMessage.addListener(function(msg, _, sendResponse) {
    _gaq.push(msg.event);
    sendResponse("Success");
});

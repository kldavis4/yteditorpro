//Google Analytics Setup
//
var _gaq = _gaq || [];
_gaq.push(function() {
    _gaq.push(['_setAccount', 'UA-10393243-10']);
});

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

chrome.runtime.onMessage.addListener(function(msg, _, sendResponse) {
    _gaq.push(msg.event);
    sendResponse("Success");
});

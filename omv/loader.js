var s = document.createElement('script');
s.src = chrome.extension.getURL('tracer.js');
s.onload = function() {
    this.remove();
};
var elem = (document.head || document.documentElement);
elem.insertBefore(s, elem.firstChild);

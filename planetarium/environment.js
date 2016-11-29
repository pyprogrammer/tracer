/**
 * Created by nzhang-dev on 11/25/16.
 */



(function(){
   var count = 0;
   var current = 0;
   function asyncLoadExecute(src) {
      var request = new XMLHttpRequest();
      var cnt = count++;
      request.open('GET', src, true);
      request.timeout = 1000;
      request.onreadystatechange = function() {
         if (request.readyState != XMLHttpRequest.DONE || request.status != 200) {
            return;
         }
         var interval = setInterval(function(){
            if (current == cnt) {
               current++;
               clearInterval(interval);
               window.eval(generateWrapper(instrumentCode(request.responseText, true), !blacklisted(src), src));
            }
         }, 10);
      };
      request.send();
   }

   function instrumentInline(codeobj) {
      var stack = lookupMetadata(codeobj.getAttribute("tracer-meta"));
      var isBlack = isBlacklisted(stack);
      return generateWrapper(instrumentCode(codeobj.innerHTML, true), isBlack, "inline");
   }

   function addInstrumentation(node) {
      if (node.src) {
         asyncLoadExecute(node.src);
         node.src = "";
      } else {
         var code = instrumentInline(node);
         var cnt = count++;
         var interval = setInterval(function(){
            if (current == cnt) {
               current++;
               clearInterval(interval);
               window.eval(code);
            }
         }, 10);
      }
   }
   // Mock Node methods
   var names = {
      "appendChild": function(node) {
         if (!(this.getRootNode() === document))
            return old["appendChild"].call(this, node);
         // do a sweep through the child nodes that are scripts
         if (node.tagName === "SCRIPT") {
            addInstrumentation(node);
         } else {
            Array.prototype.forEach.call(node.getElementsByTagName("script"), addInstrumentation);
         }
         return old["appendChild"].call(this, node);
      },
      "insertBefore": function(node, before) {
         if (!(this.getRootNode() === document))
            return old["insertBefore"].call(this, node, before);
         // do a sweep through the child nodes that are scripts
         if (node.tagName === "SCRIPT") {
            addInstrumentation(node);
         } else {
            if (node instanceof Element)
               Array.prototype.forEach.call(node.getElementsByTagName("script"), addInstrumentation);
         }
         return old["insertBefore"].call(this, node, before);
      }
   };

   var old = {};
   for (var method in names) {
      old[method] = HTMLElement.prototype[method];
      HTMLElement.prototype[method] = function () {
         var that = this;
         var res = names[method].apply(that, arguments);
         purgeUntrusted();
         return res;
      }
   }

   (function(){
      var i = 0;
      var createElement = document.createElement;
      document.createElement = function(tagName) {
         var element = createElement.call(document, tagName);
         metadata[ctr] = ErrorStackParser.parse(new Error('boom'));
         element.setAttribute("tracer-meta", ctr++);
         element.classList.add("__instrumented");
         return element;
      }
   })();
})();
var metadata = {};
var ctr = 0;

var anonymous = {};
document.write = function(){};

function lookupMetadata(metaId) {
   var stack = metadata[metaId];
   if (stack === undefined) {
      console.log("Warning: Metadata not defined! Tracking unsupported?");
      return null;
   }
   var data = [];
   for (var i = 0; i < stack.length; i++){
      var elem = stack[i];
      if (elem.functionName && anonymous.hasOwnProperty(elem.functionName)) {
         data.push(anonymous[elem.functionName]);
      }
   }
   return data;
}

function isBlacklisted(metadata) {
   if (metadata === null || metadata === undefined) {
      console.log("Warning: Null or undefined metadata!");
      return false;
   }
   var isListed = false;
   for (var j = 0; j < metadata.length; j++) {
      isListed |= blacklisted(metadata[j]);
   }
   return isListed;
}

function purgeUntrusted() {
   var instrumented = Array.prototype.slice.apply(document.getElementsByClassName("__instrumented"));
   for (var i = 0; i < instrumented.length; i++) {
      if (instrumented[i].style.display == 'none') continue;
      var id = parseInt(instrumented[i].getAttribute("tracer-meta"));
      var meta = lookupMetadata(id);
      if (isBlacklisted(meta)) {
         instrumented[i].style.display = 'none';
      }
   }
}

MockFunction.__functionHandle = Function;
function MockFunction() {
   var functionHeader = "(function()";
   var args = Array.prototype.slice.call(arguments);
   args[args.length-1] = "return " + instrumentCode("(" + functionHeader + "{" + args[args.length-1] + "}))();");
   args.unshift(null);
   return new (MockFunction.__functionHandle.prototype.bind.apply(MockFunction.__functionHandle, args));
}
MockFunction.prototype = MockFunction.__functionHandle.prototype;
window.Function = MockFunction;

function getEval(context) {
   function evalInContext(js) {
      // Return the results of the in-line anonymous function we .call with the passed context
      return function () {
         var window = context["window"];
         console.log("captured global eval");
         return eval(js);
      }.call(context);
   }
   return evalInContext;
}

function generateWrapper(codeString) {
   // The context needs to be consistent with the function call below in order to mock the environment
   return "(function(){" +
      getEval.toString() + "\n" +
      "var context = { window: 'breaker', document: document};\n" +
      "var window = context.window;\n" +
      "(function(window, document, __reval) {\n" +
         codeString +
      "\n})(window, document, getEval(context));\n})();";
}

function traverseAST(node, visitor) {
   if (visitor.call(null, node) === false) {
      return;
   }
   for (prop in node) {
      if (node.hasOwnProperty(prop)) {
         child = node[prop];
         if (typeof child === 'object' && child != null) {
            traverseAST(child, visitor);
         }
      }
   }
}

function randomIdentifier() {
   var alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
   var name = [];
   name.push(alphabet.charAt(Math.floor(Math.random()*26)));
   for (var i = 0; i < 6; ++i) {
      name.push(alphabet.charAt(Math.floor(Math.random()*alphabet.length)));
   }
   return name.join('');
}

function instrumentEvals(code) {
   var tree = esprima.parse(code, { range: true });
   var evalCalls = [];
   // Visit CallExpressions in the AST and note the character ranges for
   // eval-like functions.
   traverseAST(tree, function(node) {
      if (node.type === 'CallExpression' && node.arguments.length > 0) {
         if (node.callee.type === 'Identifier' && !(node.callee.name === "eval")) {
            var args = [];
            for (var i = 0; i < node.arguments.length; i++) {
               args[i] = node.arguments[i].range;
            }
            evalCalls.push({
               callRange: node.range,
               argRange: args
            });
         }
      }
      return true;
   });
   // Iterate backwards so that we can safely use the ranges
   // we calculated earlier, otherwise we'd need to keep track
   // of the offset.
   for (var i = evalCalls.length - 1; i >= 0; i -= 1) {
      var callRange = evalCalls[i].callRange;
      var callText = code.slice(callRange[0], callRange[1]);
      var argRange = evalCalls[i].argRange;
      var argText = code.slice(argRange[0][0], argRange[argRange.length - 1][1]);
      // var newId = randomIdentifier();
      // Replaces first occurance, which should be correct
      // considering the argument we care about is the first one.
      // var instrumentedText = callText.replace(argText, newId);
      // instrumentation = "var " + newId + " = " + argText + ";\n" +
      //    "/*if (eval === globalEval) {\n" +
      //       newId + " = instrumentEvals(" + newId + ");\n" +
      //       "eval = realEval;\n" +
      //       instrumentedText + "\n" +
      //       "eval = fakeEval;\n" +
      //    "} else {\n" +
      //       instrumentedText + "\n" +
      //    "};*/";
      /*
       If eval is actually eval, then we use local eval. Otherwise, we use the args.
       */
      // console.log(callText);
      var firstArg = code.slice(argRange[0][0], argRange[0][1]);
      var restArgs = "";
      // console.log(firstArg);
      var defaultCall = "__reval(" + argText + ")";
      var instrumentation = "(eval === __reval ? (typeof " + firstArg +
         " === 'string' ? __reval(instrumentEvals(" + firstArg +")" + restArgs +"): " + defaultCall +
         ") :" + defaultCall + ")";
      code = code.slice(0, callRange[0]) + instrumentation + code.slice(callRange[1], code.length);
   }
   return code;
}

function sandbox(scriptTag) {
   var newScript = document.createElement('script');
   if (!scriptTag.hasAttribute('sandbox')) {
      var newCode;
      if (scriptTag.hasAttribute('src')) {
         var scriptURL = scriptTag.getAttribute('src');
         var request = new XMLHttpRequest();
         request.open('GET', scriptURL, false);
         request.send();
         scriptTag.removeAttribute('src');
         newCode = request.responseText;
      } else {
         newCode = scriptTag.innerHTML;
      }
      newScript.innerHTML = generateWrapper(instrumentEvals(newCode));
      scriptTag.parentNode.insertBefore(newScript, scriptTag);
      scriptTag.parentNode.removeChild(scriptTag);
   } else {
      var newScript = scriptTag.cloneNode();
      scriptTag.parentNode.insertBefore(newScript, scriptTag);
      scriptTag.parentNode.removeChild(scriptTag);
   }
}


function getEval(context) {
   function evalInContext(js) {
      // Return the results of the in-line anonymous function we .call with the passed context
      return function () {
         var window = context["window"];
         return eval(js);
      }.call(context);
   }
   return evalInContext;
}

function generateWrapper(codeString, trusted) {
   // The context needs to be consistent with the function call below in order to mock the environment
   return `(function(window){
   ${getEval.toString()}
   var context = { window: window, document: document};
   (function(window, document, __reval) {
      ${codeString}
   })(window, document, getEval(context));
})${trusted ? "(trustedParam)" : "(untrustedParam)"};`;
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

function instrument(code) {
   var tree = esprima.parse(code, { range: true });
   var replacements = [];
   // Visit nodes in the AST to determine pieces we need to replace
   traverseAST(tree, function(node) {
      if (node.type === 'CallExpression' && node.arguments.length > 0) {
         if (node.callee.type === 'Identifier' && !(node.callee.name === "eval")) {
            var args = [];
            for (var i = 0; i < node.arguments.length; i++) {
               args[i] = node.arguments[i].range;
            }
            replacements.push({
               type: 'eval',
               replaceRange: node.range,
               argRange: args
            });
         }
      } else if (node.type === 'AssignmentExpression') {
         if (node.left.type === 'Identifier' && node.left.name === 'window') {
            replacements.push({
               type: 'windowAssign',
               replaceRange: [node.range[0], node.right.range[0]]
            });
         }
      }
      return true;
   });
   // Iterate backwards so that we can safely use the ranges
   // we calculated earlier, otherwise we'd need to keep track
   // of the offset.
   for (var i = replacements.length - 1; i >= 0; i -= 1) {
      // Set to empty by default; some cases are just deleting code.
      var instrumentation = "";
      var replaceRange = replacements[i].replaceRange;
      if (replacements[i].type === 'eval') {
         var callRange = replaceRange;
         var callText = code.slice(callRange[0], callRange[1]);
         var argRange = replacements[i].argRange;
         var argText = code.slice(argRange[0][0], argRange[argRange.length - 1][1]);
         // If eval is actually eval, then we use local eval. Otherwise, we use the args.
         // console.log(callText);
         var firstArg = code.slice(argRange[0][0], argRange[0][1]);
         var restArgs = "";
         // console.log(firstArg);
         var defaultCall = "__reval(" + argText + ")";
         instrumentation = `(eval === __reval ? 
            (typeof ${firstArg} === 'string' ? 
               __reval(instrument(${firstArg})${restArgs})
               : ${defaultCall})
            : ${defaultCall})`;
      }
      // Replace instrumentation in code.
      code = code.slice(0, replaceRange[0]) + instrumentation + code.slice(replaceRange[1], code.length);
   }
   return code;
}

function sandbox(scriptTag) {
   var newScript = document.createElement('script');
   if (!scriptTag.hasAttribute('sandbox')) {
      var newCode;
      var scriptURL = document.URL;
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
      newScript.innerHTML = generateWrapper(instrument(newCode), blacklisted(scriptURL));
      scriptTag.parentNode.insertBefore(newScript, scriptTag);
      scriptTag.parentNode.removeChild(scriptTag);
   } else {
      var newScript = scriptTag.cloneNode();
      scriptTag.parentNode.insertBefore(newScript, scriptTag);
      scriptTag.parentNode.removeChild(scriptTag);
   }
}

function mockWindow() {
   var that = this;
   var shortCircuitedFunctions = {
      "confirm": false,
      "alert": false
   };
   for (var attrib in window) {
      (function(name) {
         Object.defineProperty(that, name, {
            get: function () {
               console.log(name);
               if (name in shortCircuitedFunctions) {
                  return (function() { return shortCircuitedFunctions[name]});
               }
               return window[name];
            }
         });
      })(attrib);
   }
}

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
   if (visitor.call(null, null, null, node) === false) {
      return;
   }
   _traverseAST(node, visitor);
}

function _traverseAST(node, visitor) {
   for (prop in node) {
      if (node.hasOwnProperty(prop)) {
         child = node[prop];
         if (typeof child === 'object' && child != null) {
            if (visitor.call(null, node, prop, child) === false) {
               return;
            }
            _traverseAST(node[prop], visitor);
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

function evalInstrumentationAST() {
   var tree = esprima.parse(`(arg0 === eval ? (typeof arg1 === 'string' ? arg2 : arg3) : arg4)`);
   var args = arguments;
   traverseAST(tree, function(nparent, prop, node) {
      if (node.type === 'Identifier' && node.name.substring(0, 3) === 'arg') {
         nparent[prop] = args[parseInt(node.name.substring(3))];
      }
      return true;
   });
   return tree.body[0].expression;
}

function instrumentCode(code) {
   var tree = esprima.parse(code);
   // Visit nodes in the AST and perform node replacement
   traverseAST(tree, function(nparent, prop, node) {
      if (nparent === null) {
         return true;
      }
      if (node.type === 'CallExpression' && node.arguments.length > 0) {
         if (node.callee.type === 'Identifier' && !(node.callee.name === "eval")) {
            var reval_call1 = {
               type: 'CallExpression',
               callee: {
                  type: 'Identifier',
                  name: '__reval',
               },
               arguments: [{
                  type: 'CallExpression',
                  callee: {
                     type: 'Identifier',
                     name: 'instrumentCode',
                  },
                  arguments: [node.arguments[0]],
               }].concat(node.arguments.slice(1, node.arguments.length))
            };
            var reval_call2 = {
               type: 'CallExpression',
               callee: {
                  type: 'Identifier',
                  name: '__reval',
               },
               arguments: node.arguments
            };
            nparent[prop] = evalInstrumentationAST(node.callee, node.arguments[0], reval_call1, reval_call2, node);
         }
      } else if (node.type === 'AssignmentExpression') {
         if (node.left.type === 'Identifier' && node.left.name === 'window') {
            nparent[prop] = node.right;
         }
      }
      return true;
   });
   var result = escodegen.generate(tree);
   return result;
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
      newScript.innerHTML = generateWrapper(instrumentCode(newCode), blacklisted(scriptURL));
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

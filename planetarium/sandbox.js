var LOG_PREFIX = "[PLANETARIUM]"

function logDebug(str) {
   console.log(LOG_PREFIX + " " + str);
}

logDebug("Load sandbox.js");

Error.stackTraceLimit = Infinity;

function ASTVisitor(visitor /* function */) {
   this.visit = visitor.bind(this);
   this.genericVisit = (function(astNode) {
      for (var property in astNode) {
         if (!astNode.hasOwnProperty(property)) continue;
         if (typeof astNode[property] === 'object' && astNode[property] != null) {
            astNode[property] = this.visit(astNode[property]);
         }
      }
      return astNode;
   }).bind(this);
}

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


function generateWrapper(codeString, trusted, name) {
   // The context needs to be consistent with the function call below in order to mock the environment
   var accum = [];
   if (codeString instanceof Array) {
      accum = codeString[1];
      codeString = codeString[0];
   }
   var identifier = "wrapper__" + Math.random().toString(36).substr(2);
   var decls = "";
   if (accum.length > 0) decls = "var " + accum.join(", ") + ";";
   var register = `anonymous["${identifier}"] = "${name}";\n`;
   return register + decls + `(function(){
   ${getEval.toString()}
   
   var context = { window: window, document: document};
   (function ${identifier} (document, __reval) {
      ${codeString}
   }).call(window, document, getEval(context));
})();`;
}

function evalInstrumentationAST(name, arglist) {
   // If we find a node called eval(... arglist);
   // we replace it with (eval === <handle to real eval> ? eval(instrumentCode(a), b, c, ...) : eval(a, b, c...))
   var evalHandle = { // eval === <handle to real eval>
      "type": "BinaryExpression",
      "operator": "===",
      "left": name,
      "right": {
         "type": "Identifier",
         "name": "__global_eval"
      }
   };

   var evalWithInstrumentation = {
      "type": "CallExpression",
      "callee": {
         "type": "Identifier",
         "name": "__reval"
      },
      "arguments": [
         {
            "type": "CallExpression",
            "callee": {
               "type": "Identifier",
               "name": "instrumentCode"
            },
            "arguments": [
               arglist[0]
            ]
         },
         ...arglist.slice(1)
      ]
   };

   var originalEvalCall = {
      "type": "CallExpression",
      "callee": name,
      "arguments": arglist.slice()
   };

   var conditional = {
      "type": "ConditionalExpression",
      "test": evalHandle,
      "consequent": evalWithInstrumentation,
      "alternate": originalEvalCall,
   };

   return conditional;
}

function instrumentEvals(ast) {
   var visitor = new ASTVisitor(
      function(astNode) {
         if (astNode.type === 'CallExpression' && astNode.arguments.length > 0) {
            if (astNode.callee.type != 'Identifier' || !(astNode.callee.name === "eval")) {
               // Calling a function without using eval(...)
               return evalInstrumentationAST(astNode.callee, astNode.arguments);
            }
         }
         return this.genericVisit(astNode);
      }
   );
   visitor.visit(ast);
}

function variableDeclaratorToAssignment(astNode) {
   return  {
      "type": "AssignmentExpression",
      "operator": "=",
      "left": astNode.id,
      "right": astNode.init != null ? astNode.init : {
         "type": "Identifier",
         "name": "undefined"
      }
   };
}

function saveVariables(ast) {
   var accum = [];
   (new ASTVisitor(
      function (astNode) {
         if (astNode.type === "ForStatement") {
            if (astNode.init && astNode.init.type === "VariableDeclaration") {
               var body = [];
               for (var i = 0; i < astNode.init.declarations.length; i++) {
                  accum.push(astNode.init.declarations[i].id.name);
                  body.push(variableDeclaratorToAssignment(astNode.init.declarations[i]));
               }
               astNode.init = {
                  "type": "SequenceExpression",
                  "expressions": body
               };
               return this.genericVisit(astNode);
            }
         } else if (astNode.type === "VariableDeclaration") {
            var body = [];
            for (var i = 0; i < astNode.declarations.length; i++) {
               accum.push(astNode.declarations[i].id.name);
               body.push(variableDeclaratorToAssignment(astNode.declarations[i]));
            }
            return {
               "type": "ExpressionStatement",
               "expression": {
                  "type": "SequenceExpression",
                  "expressions": body
               }
            };
         } else if (astNode.type == "FunctionDeclaration" || astNode.type == "FunctionExpression") {
            return astNode; // don't visit children
         } else if (astNode.type == "ForInStatement") {
            if (astNode.left.type == "VariableDeclaration") {
               // Assume we have an identifier
               accum.push(astNode.left.declarations[0].id.name);
               astNode.left = astNode.left.declarations[0].id;
               return this.genericVisit(astNode);
            }
         }
         return this.genericVisit(astNode);
      }
   )).visit(ast);

   return accum;
}

function instrumentCode(code, lift=false) {
   if (typeof code !== "string") {
      return code; // Not actually a code obj
   }
   var tree;
   try {
      tree = esprima.parse(code);
   } catch (e) {
      return code;
   }
   instrumentEvals(tree);
   if (lift) {
      var accum = saveVariables(tree);
      return [escodegen.generate(tree), accum];
   }
   // Visit nodes in the AST and perform node replacement
   var result = escodegen.generate(tree);
   return result;
}

function replaceSandboxed(newScript, scriptTag) {
   scriptTag.parentNode.insertBefore(newScript, scriptTag);
   scriptTag.parentNode.removeChild(scriptTag);
}

function instrumentScript(code, url) {
   return generateWrapper(instrumentCode(code, true), blacklisted(url), url);
}

var prevRan = 0;
function sandboxInitial(scriptTag, ord) {
   if (prevRan != ord) {
      setTimeout(function() { sandboxInitial(scriptTag, ord) }, 10);
      return;
   }
   if (isScript(scriptTag) && !scriptTag.hasAttribute('sandbox')) {
      var newScript = document.createElement('script');
      if (scriptTag.hasAttribute('src')) {
         var scriptURL = scriptTag.getAttribute('src');
         var request = new XMLHttpRequest();
         request.open('GET', scriptURL, true);
         request.onreadystatechange = function() {
            if (request.readyState != XMLHttpRequest.DONE || request.status != 200) {
               return;
            }
            logDebug("Loading: " + scriptURL);
            scriptTag.setAttribute("hasDefine", request.responseText.indexOf("define") != -1);
            newScript.innerHTML = instrumentScript(request.responseText, scriptURL);
            replaceSandboxed(newScript, scriptTag);
            prevRan += 1;
         };
         request.send();
         scriptTag.removeAttribute('src');
         return;
      } else {
         logDebug("Inline JS");
         // if (scriptTag.innerHTML.indexOf("define") != -1) logDebug("DEFINE");
         scriptTag.setAttribute("hasDefine", scriptTag.innerHTML.indexOf("define") != -1);
         newScript.innerHTML = instrumentScript(scriptTag.innerHTML, document.URL);
         replaceSandboxed(newScript, scriptTag);
      }
   } else {
      var newScript = scriptTag.cloneNode();
      replaceSandboxed(newScript, scriptTag);
   }
   prevRan += 1;
}

function fixListeners(ord) {
   if (prevRan != ord) {
      setTimeout(function() { fixListeners(ord) }, 10);
      return;
   }
   var patcher = document.createElement("script");
   patcher.innerHTML = "fixDOMContentLoaded();";
   document.documentElement.appendChild(patcher);
}

function getText(src) {
   var request = new XMLHttpRequest();
   request.open('GET', src, false);
   request.send();
   return request.responseText;
}

function isScript(node) {
   return node.type === "" || node.type.toLowerCase().indexOf("javascript") != -1;
}


window.__global_eval = eval;

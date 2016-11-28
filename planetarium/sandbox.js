console.log("SANDBOX.js");

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

function MockFunction() {
   var functionHeader = "(function()";
   var args = Array.prototype.slice.call(arguments);
   args[args.length-1] = "return " + instrumentCode("(" + functionHeader + "{" + args[args.length-1] + "}))();");
   args.unshift(null);
   return new (Function.prototype.bind.apply(Function, args));
}
MockFunction.prototype = Function.prototype;

function generateWrapper(codeString, trusted) {
   // The context needs to be consistent with the function call below in order to mock the environment
   return `(function(){
   ${getEval.toString()}
   
   function f() {
      var functionHeader = "(function()";
      var args = Array.prototype.slice.call(arguments);
      args[args.length-1] = "return " + instrumentCode("(" + functionHeader + "{" + args[args.length-1] + "}))();");
      args.unshift(null);
      return new (Function.prototype.bind.apply(Function, args));
   }
   f.prototype = Function.prototype;
   
   var context = { window: window, document: document, Function: f};
   (function(document, __reval, Function) {
      ${codeString}
   }).call(window, document, getEval(context), f);
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
function uninitializeVariable(vid) {
   var bestNameEver = "asdfljaansfdklnjllijadsfkljasfhiluawef";
   return  [
      {
         "type": "VariableDeclaration",
         "declarations": [
            {
               "type": "VariableDeclarator",
               "id": {
                  "type": "Identifier",
                  "name": bestNameEver
               },
               "init": {
                  "type": "LogicalExpression",
                  "operator": "||",
                  "left": vid,
                  "right": {
                     "type": "Identifier",
                     "name": "undefined"
                  }
               }
            }
         ],
         "kind": "var"
      },
      {
      "type": "ExpressionStatement",
      "expression": {
         "type": "AssignmentExpression",
         "operator": "=",
         "left": vid,
         "right": {
            "type": "Identifier",
            "name": bestNameEver
         }
      }
   }];
}
function saveVariables(ast) {
   var accum = [];
   (new ASTVisitor(
      function (astNode) {
         if (astNode.type === "ForStatement") {
            if (astNode.init && astNode.init.type === "VariableDeclaration") {
               var body = [];
               for (var i = 0; i < astNode.init.declarations.length; i++) {
                  accum.push(astNode.init.declarations[i].id);
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
               accum.push(astNode.declarations[i].id);
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
               accum.push(astNode.left.declarations[0].id);
               astNode.left = astNode.left.declarations[0].id;
               return this.genericVisit(astNode);
            }
         }
         return this.genericVisit(astNode);
      }
   )).visit(ast);
   for (var i = accum.length-1; i >= 0; --i) {
      var tmp = uninitializeVariable(accum[i]);
      for (var j = 0; j < tmp.length; j++) {
         ast.body.unshift(tmp[j]);
      }
   }
}

function instrumentCode(code) {
   if (typeof code !== "string") {
      return code; // Not actually a code obj
   }
   var tree = esprima.parse(code);
   instrumentEvals(tree);
   saveVariables(tree);
   // Visit nodes in the AST and perform node replacement
   var result = escodegen.generate(tree);
   return result;
}

function replaceSandboxed(newScript, scriptTag) {
   scriptTag.parentNode.insertBefore(newScript, scriptTag);
   scriptTag.parentNode.removeChild(scriptTag);
}

function instrumentScript(code, url) {
   return generateWrapper(instrumentCode(code), blacklisted(url));
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
            newScript.innerHTML = instrumentScript(request.responseText, scriptURL);
            replaceSandboxed(newScript, scriptTag);
            prevRan += 1;
         };
         request.send();
         scriptTag.removeAttribute('src');
         return;
      } else {
         newScript.innerHTML = instrumentScript(scriptTag.innerHTML, document.URL);
         replaceSandboxed(newScript, scriptTag);
      }
   } else {
      var newScript = scriptTag.cloneNode();
      replaceSandboxed(newScript, scriptTag);
   }
   prevRan += 1;
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

window.Function = MockFunction;
window.__global_eval = eval;

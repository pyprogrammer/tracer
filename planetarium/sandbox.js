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

function generateWrapper(codeString, trusted) {
   // The context needs to be consistent with the function call below in order to mock the environment
   return `(function(window){
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
   (function(window, document, __reval, Function) {
      ${codeString}
   }).call(window, window, document, getEval(context), f);
})(${trusted ? "trustedParam" : "untrustedParam"});`;
}

function evalInstrumentationAST(name, arglist) {
   // If we find a node called eval(... arglist);
   // we replace it with (eval === <handle to real eval> ? eval(instrumentCode(a), b, c, ...) : eval(a, b, c...))
   var evalHandle = { // eval === <handle to real eval>
      "type": "BinaryExpression",
      "operator": "===",
      "left": {
         "type": "Identifier",
         "name": name
      },
      "right": {
         "type": "Identifier",
         "name": "eval"
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
      "callee": {
         "type": "Identifier",
         "name": name
      },
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
            if (astNode.callee.type === 'Identifier' && !(astNode.callee.name === "eval")) {
               return evalInstrumentationAST(astNode.callee.name, astNode.arguments);
            }
         }
         return this.genericVisit(astNode);
      }
   );
   visitor.visit(ast);
}

// if Var declarations are made at the top level, they need to become global assigments instead
/*
 {
 "type": "VariableDeclarator",
 "id": {
 "type": "Identifier",
 "name": "x"
 },
 "init": {
 "type": "Literal",
 "value": 3,
 "raw": "3"
 }
 },
 */

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
   return (new ASTVisitor(
      function (astNode) {
         if (astNode.type === "VariableDeclaration") {
            var body = [];
            for (var i = 0; i < astNode.declarations.length; i++) {
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
         }
         return this.genericVisit(astNode);
      }
   )).visit(ast);
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

function getText(src) {
   var request = new XMLHttpRequest();
   request.open('GET', src, false);
   request.send();
   return request.responseText;
}


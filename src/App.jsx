import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import QueryEditor from './components/QueryEditor';
import CompilerPipeline from './components/CompilerPipeline';
import TokenPanel from './components/TokenPanel';
import AstPanel from './components/AstPanel';
import SqlPanel from './components/SqlPanel';
import StatusBar from './components/StatusBar';
import SchemaManagerModal from './components/SchemaManagerModal';
import { DATABASE_SCHEMA } from './data/schema';
import { processNLU } from './compiler/nlu/nluEngine.js';
import { tokenize } from './compiler/lexer/lexer.js';
import { buildAST } from './compiler/ast/astBuilder.js';
import { analyze }  from './compiler/semantic/semanticAnalyzer.js';
import { buildIR }  from './compiler/ir/irBuilder.js';
import { generateSQL } from './compiler/sql/sqlGenerator.js';
import SemanticPanel from './components/SemanticPanel';
import IrPanel from './components/IrPanel';
import ResultPanel from './components/ResultPanel';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  // ── Schema state (Live PostgreSQL with mock fallback) ──────────────────
  const [currentSchema, setCurrentSchema] = useState(DATABASE_SCHEMA);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  // ── Compilation state ──────────────────────────────────────────────────
  const [compilationStatus, setCompilationStatus] = useState('Idle');
  const [lexerResult,  setLexerResult]  = useState(null); 
  const [parserResult, setParserResult] = useState(null); 
  const [astResult,    setAstResult]    = useState(null); 
  const [semanticResult, setSemanticResult] = useState(null);
  const [irResult, setIrResult] = useState(null);
  const [sqlResult, setSqlResult] = useState(null);
  const [dbResult, setDbResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isVisualizing, setIsVisualizing] = useState(false);

  const [treeStatus, setTreeStatus] = useState('idle');
  const [semanticStatus, setSemanticStatus] = useState('idle');
  const [irStatus, setIrStatus] = useState('idle');

  // ── Fetch live schema from backend ────────────────────────────────────
  const fetchSchema = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/schema');
      const result = await response.json();
      if (result.success && result.data) {
        setCurrentSchema(result.data);
      }
    } catch {
      // Offline fallback: keep currentSchema as is
    }
  }, []);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  // ── Derive pipeline stage states ──────────────────────────────────────
  const stageStates = (() => {
    if (!lexerResult) return {};

    const lexHasErrors = lexerResult.errors.length > 0;
    const lexHasTokens = lexerResult.tokens.length > 0;
    if (!lexHasTokens && !lexHasErrors) return {};

    if (isVisualizing) {
      return { input: 'success', lexer: 'active' };
    }

    const lexState = lexHasErrors ? 'error' : 'success';

    if (lexHasErrors) {
      return { input: 'success', lexer: 'error' };
    }

    if (!parserResult) {
      return { input: 'success', lexer: lexState };
    }

    const parserState = parserResult.success ? 'success' : 'error';
    
    let parseTreeState = 'idle';
    if (parserResult.success) {
      if (treeStatus === 'animating') parseTreeState = 'active';
      else if (treeStatus === 'complete') parseTreeState = 'success';
    }

    let astState = 'idle';
    if (astResult) {
       astState = astResult.success ? 'success' : 'error';
    }

    let semState = 'idle';
    if (astResult && astResult.success && semanticResult) {
      if (semanticStatus === 'animating') semState = 'active';
      else if (semanticStatus === 'success') semState = 'success';
      else if (semanticStatus === 'error') semState = 'error';
    }

    let iState = 'idle';
    if (semanticStatus === 'success' && irResult) {
      if (irStatus === 'animating') iState = 'active';
      else if (irStatus === 'success') iState = 'success';
      else if (irStatus === 'error') iState = 'error';
    }

    let sqlState = 'idle';
    if (irStatus === 'success' && sqlResult) {
      sqlState = sqlResult.sql ? 'success' : 'error';
    }

    let dbState = 'idle';
    if (sqlState === 'success') {
      if (isExecuting) dbState = 'active';
      else if (dbResult && dbResult.success) dbState = 'success';
      else if (dbResult && dbResult.error) dbState = 'error';
    }

    return {
      input:  'success',
      lexer:  lexState,
      parser: parserState,
      parseTree: parseTreeState,
      ast:    astState,
      semantic: semState,
      ir: iState,
      sql: sqlState,
      db: dbState
    };
  })();

  // ── Execute SQL ────────────────────────────────────────────────────────
  const executeSQL = async (sql) => {
    setIsExecuting(true);
    setDbResult(null);
    setCompilationStatus('Executing query...');

    try {
      const response = await fetch('http://localhost:3001/api/query/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });
      
      const result = await response.json();
      setDbResult(result);
      
      if (result.success) {
        setCompilationStatus('✓ Database Execution Complete');
      } else {
        setCompilationStatus('⚠ Database Error');
      }
    } catch (err) {
      setDbResult({
        success: false,
        error: {
          type: 'NETWORK_ERROR',
          message: err.message || 'Failed to connect to backend server. Make sure it is running.'
        }
      });
      setCompilationStatus('⚠ Database Connection Error');
    } finally {
      setIsExecuting(false);
    }
  };

  // ── Called by QueryEditor on each compile ──────────────────────────────
  const handleCompile = useCallback((query) => {
    setCurrentQuery(query);
    setIsVisualizing(false);

    setTreeStatus('idle');
    setSemanticStatus('idle');
    setIrStatus('idle');
    setDbResult(null);
    setIsExecuting(false);

    // Step 0: Deterministic Natural Language Understanding
    const nluResult = processNLU(query, currentSchema);

    // Step 1: Lexer (Format tokens for TokenPanel)
    let lexResult;
    if (nluResult.tokens && nluResult.tokens.length > 0) {
      lexResult = { tokens: nluResult.tokens, errors: [] };
    } else {
      lexResult = tokenize(query, currentSchema);
    }
    setLexerResult(lexResult);

    let pResult = null;
    let aResult = null;
    let sResult = null;
    let iResult = null;
    let sqResult = null;

    if (nluResult.errors && nluResult.errors.length > 0 && !nluResult.canonicalQuery) {
      const err = nluResult.errors[0];
      const errMsg = typeof err === 'string' ? err : err.message || 'NLU Error';
      setLexerResult({ tokens: [], errors: [{ message: errMsg }] });
      setParserResult(null);
      setAstResult(null);
      setSemanticResult(null);
      setIrResult(null);
      setSqlResult(null);
      setCompilationStatus(`⚠ ${errMsg}`);
      return;
    }

    if (nluResult.canonicalQuery) {
      // Step 2: Build Concrete Syntax Tree (ParseTree visualizer)
      const cstChildren = [
        { type: 'ACTION', value: nluResult.canonicalQuery.intent, children: [] },
        { type: 'SOURCE', value: nluResult.canonicalQuery.sources[0] || 'students', children: [] }
      ];

      if (nluResult.canonicalQuery.joins && nluResult.canonicalQuery.joins.length > 0) {
        nluResult.canonicalQuery.joins.forEach(j => {
          cstChildren.push({ type: 'JOIN', value: `${j.left} = ${j.right}`, children: [] });
        });
      }

      if (nluResult.canonicalQuery.projections && nluResult.canonicalQuery.projections.length > 0) {
        cstChildren.push({
          type: 'PROJECTION',
          value: null,
          children: nluResult.canonicalQuery.projections.map(p => ({
            type: p.includes('(') ? 'AGGREGATE' : 'COLUMN',
            value: p,
            children: []
          }))
        });
      }

      if (nluResult.canonicalQuery.conditions && nluResult.canonicalQuery.conditions.length > 0) {
        const condNodes = nluResult.canonicalQuery.conditions.map(c => ({
          type: 'SIMPLE_CONDITION',
          value: null,
          children: [
            { type: 'COLUMN', value: c.column, children: [] },
            { type: 'OPERATOR', value: c.operator, children: [] },
            { type: 'VALUE', value: String(c.value), children: [] }
          ]
        }));
        cstChildren.push({
          type: 'CONDITION_CLAUSE',
          value: null,
          children: condNodes
        });
      }

      const visualTree = {
        type: 'QUERY',
        value: null,
        children: cstChildren
      };

      pResult = {
        success: true,
        tree: visualTree,
        errors: [],
        nodeCount: cstChildren.length + 1
      };
      setParserResult(pResult);

      // Step 3: AST Construction
      aResult = buildAST({ type: 'CanonicalQuery', ...nluResult.canonicalQuery });
      setAstResult(aResult);

      if (aResult.success && aResult.ast) {
        // Step 4: Semantic Analysis against live schema
        sResult = analyze(aResult.ast, currentSchema);
        setSemanticResult(sResult);

        if (sResult.success) {
          // Step 5: Intermediate Representation (IR)
          iResult = buildIR(sResult.ast);
          setIrResult(iResult);

          if (iResult.success && iResult.ir) {
            // Step 6: SQL Generation
            sqResult = generateSQL(iResult.ir);
            setSqlResult(sqResult);
          } else {
            setSqlResult(null);
          }
        } else {
          setIrResult(null);
          setSqlResult(null);
        }
      } else {
        setSemanticResult(null);
        setIrResult(null);
        setSqlResult(null);
      }
    } else {
      setParserResult(null);
      setAstResult(null);
      setSemanticResult(null);
      setIrResult(null);
      setSqlResult(null);
    }

    let newStatus;
    if (lexResult.errors.length > 0) {
      newStatus = 'Lexical errors found';
    } else if (!pResult) {
      newStatus = 'Lexer complete';
    } else if (!pResult.success) {
      newStatus = 'Syntax errors found';
    } else if (!aResult || !aResult.success) {
      newStatus = 'AST construction failed';
    } else if (!sResult || !sResult.success) {
      newStatus = 'Semantic errors found';
    } else if (!iResult || !iResult.success) {
      newStatus = 'IR Generation Error';
    } else if (!sqResult || !sqResult.sql) {
      newStatus = 'SQL Generation Error';
    } else {
      newStatus = 'SQL Generation Complete';
    }

    setCompilationStatus(newStatus);
    return {
      tokens: lexResult.tokens,
      errors: lexResult.errors,
      lexResult,
      parserResult: pResult,
      astResult: aResult,
      semanticResult: sResult,
      irResult: iResult,
      sqlResult: sqResult
    };
  }, [currentSchema]);

  const handleStatusChange = useCallback((status) => {
    if (status === 'Idle') {
      setLexerResult(null);
      setParserResult(null);
      setAstResult(null);
      setSemanticResult(null);
      setIrResult(null);
      setSqlResult(null);
      setDbResult(null);
      setCurrentQuery('');
      setIsVisualizing(false);
      setTreeStatus('idle');
      setSemanticStatus('idle');
      setIrStatus('idle');
    }
    setCompilationStatus(status);
  }, []);

  const handleVisualizingChange = useCallback((visualizing) => {
    setIsVisualizing(visualizing);
    if (visualizing) {
      setCompilationStatus('Visualizing lexical analysis...');
    } else {
      setCompilationStatus(prev => {
        if (prev === 'Visualizing lexical analysis...') {
          return 'Lexical analysis complete';
        }
        return prev;
      });
    }
  }, []);

  const handleTreeStatusChange = useCallback((status, visibleNodes, totalNodes) => {
    setTreeStatus(status);
    if (status === 'animating') {
      setCompilationStatus(`Building parse tree... ${visibleNodes} / ${totalNodes} nodes`);
    } else if (status === 'complete') {
      setCompilationStatus('✓ Parse tree constructed');
    }
  }, []);

  const handleSemanticStatusChange = useCallback((status) => {
    setSemanticStatus(status);
    if (status === 'animating') {
      setCompilationStatus('Performing semantic analysis...');
    } else if (status === 'success') {
      setCompilationStatus('✓ Semantic Analysis Passed');
    } else if (status === 'error') {
      setCompilationStatus('⚠ Semantic Errors Found');
    }
  }, []);

  const handleIrStatusChange = useCallback((status) => {
    setIrStatus(status);
    if (status === 'animating') {
      setCompilationStatus('Generating Intermediate Representation...');
    } else if (status === 'success') {
      if (sqlResult && sqlResult.sql) {
        setCompilationStatus('✓ SQL Generation Complete');
      } else {
        setCompilationStatus('⚠ SQL Generation Error');
      }
    } else if (status === 'error') {
      setCompilationStatus('⚠ IR Generation Error');
    }
  }, [sqlResult]);

  // ── Derived counts for StatusBar ───────────────────────────────────────
  const tokensCount      = lexerResult  ? lexerResult.tokens.length  : 0;
  const lexErrCount      = lexerResult  ? lexerResult.errors.length  : 0;
  const parseErrCount    = parserResult ? parserResult.errors.length : 0;
  const semErrCount      = semanticResult ? semanticResult.errors.length : 0;
  const totalErrCount    = lexErrCount + parseErrCount + semErrCount;
  const astNodesCount    = parserResult ? parserResult.nodeCount      : 0;
  const logicalNodesCount = astResult && astResult.success ? astResult.nodeCount : 0;

  return (
    <div className="app-container">
      <Header
        status={compilationStatus === 'Idle' ? 'Ready' : compilationStatus}
        onOpenSchemaManager={() => setIsSchemaModalOpen(true)}
      />

      <div className="app-body">
        <Sidebar
          schema={currentSchema}
          onOpenSchemaManager={() => setIsSchemaModalOpen(true)}
          onRefreshSchema={fetchSchema}
        />

        <main className="main-workspace" id="main-content">
          <div className="workspace-scroll-area">
            {/* 1. Natural Language Query Editor */}
            <QueryEditor
              onStatusChange={handleStatusChange}
              onCompile={handleCompile}
            />

            {/* 2. Compilation Pipeline */}
            <CompilerPipeline
              overallStatus={compilationStatus}
              stageStates={stageStates}
            />

            {/* 3. Token + AST Split Panel */}
            <section className="output-split-section" aria-label="Compiler Phase Outputs">
              <div className="split-panel-grid">
                <ErrorBoundary title="Lexer Token Panel Error">
                  <TokenPanel
                    key={currentQuery || 'empty'}
                    tokens={lexerResult  ? lexerResult.tokens  : []}
                    errors={lexerResult  ? lexerResult.errors  : []}
                    query={currentQuery}
                    isVisualizing={isVisualizing}
                    onVisualizingChange={handleVisualizingChange}
                    canonicalQuery={lexerResult?.canonicalQuery}
                  />
                </ErrorBoundary>
                <ErrorBoundary title="Syntax Tree Panel Error">
                  <AstPanel
                    parseResult={parserResult}
                    astResult={astResult}
                    astNodesCount={astNodesCount}
                    logicalNodesCount={logicalNodesCount}
                    onTreeStatusChange={handleTreeStatusChange}
                  />
                </ErrorBoundary>
              </div>
            </section>

            {/* 4. Semantic Analysis Panel */}
            <ErrorBoundary title="Semantic Analysis Panel Error">
              <SemanticPanel 
                semanticResult={semanticResult}
                isASTComplete={treeStatus === 'complete'}
                onSemanticStatusChange={handleSemanticStatusChange}
              />
            </ErrorBoundary>

            {/* 5. Intermediate Representation Panel */}
            <ErrorBoundary title="Intermediate Representation Error">
              <IrPanel
                irResult={irResult}
                isSemanticComplete={semanticStatus === 'success'}
                onIrStatusChange={handleIrStatusChange}
              />
            </ErrorBoundary>

            {/* 6. Generated SQL */}
            {(irStatus === 'success' || sqlResult) && (
              <ErrorBoundary title="SQL Panel Error">
                <SqlPanel 
                  sqlResult={sqlResult} 
                  isExecuting={isExecuting}
                  onExecute={executeSQL}
                />
              </ErrorBoundary>
            )}

            {/* 7. Result Table */}
            {(dbResult || isExecuting) && (
              <ErrorBoundary title="Database Results Error">
                <ResultPanel dbResult={dbResult} isExecuting={isExecuting} />
              </ErrorBoundary>
            )}
          </div>
        </main>
      </div>

      <StatusBar
        tokensCount={tokensCount}
        astNodesCount={astNodesCount}
        errorsCount={totalErrCount}
        compilationStatus={compilationStatus}
        parseErrCount={parseErrCount}
      />

      {/* Dynamic Database Schema Manager Modal */}
      <SchemaManagerModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        schema={currentSchema}
        onRefresh={fetchSchema}
      />
    </div>
  );
}

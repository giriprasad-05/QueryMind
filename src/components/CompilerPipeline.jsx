import React from 'react';
import { 
  ArrowRight, 
  CircleDot, 
  Workflow, 
  CheckCircle2, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';

const PIPELINE_STAGES = [
  {
    id: 'input',
    num: '01',
    name: 'Input',
    role: 'Source NL Query',
    status: 'idle',
    description: 'Raw query intake & normalization'
  },
  {
    id: 'lexer',
    num: '02',
    name: 'Lexer',
    role: 'Token Stream',
    status: 'idle',
    description: 'Tokenization, regex & symbol identification'
  },
  {
    id: 'parser',
    num: '03',
    name: 'Parser',
    role: 'Grammar Parse',
    status: 'idle',
    description: 'Context-free grammar & parse tree creation'
  },
  {
    id: 'parseTree',
    num: '04',
    name: 'Parse Tree',
    role: 'Syntax Tree',
    status: 'idle',
    description: 'Concrete Syntax Tree construction'
  },
  {
    id: 'ast',
    num: '05',
    name: 'AST',
    role: 'Logical Tree',
    status: 'idle',
    description: 'Abstract Syntax Tree mapping'
  },
  {
    id: 'semantic',
    num: '06',
    name: 'Semantic',
    role: 'Schema Binding',
    status: 'idle',
    description: 'Type resolution & schema table verification'
  },
  {
    id: 'ir',
    num: '07',
    name: 'IR',
    role: 'Relational Algebra',
    status: 'idle',
    description: 'Intermediate representation & logical plan'
  },
  {
    id: 'sql',
    num: '08',
    name: 'SQL',
    role: 'Target Dialect',
    status: 'idle',
    description: 'Final SQL query emission'
  }
];

export default function CompilerPipeline({ stageStates = {}, overallStatus = "Idle" }) {
  const stages = PIPELINE_STAGES.map(stage => ({
    ...stage,
    status: stageStates[stage.id] || stage.status
  }));

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CircleDot size={12} className="stage-icon active stage-active-dot" />;
      case 'success':
        return <CheckCircle2 size={12} className="stage-icon success" />;
      case 'error':
        return <AlertCircle size={12} className="stage-icon error" />;
      case 'idle':
      default:
        return <CircleDot size={12} className="stage-icon idle" />;
    }
  };

  const isCompiling      = overallStatus === 'Compiling...';
  const isVisualizing    = overallStatus === 'Visualizing lexical analysis...' || stageStates.lexer === 'active';
  const isBuildingTree   = overallStatus.startsWith('Building parse tree') || stageStates.parseTree === 'active';
  const isSemanticActive = overallStatus === 'Performing semantic analysis...' || stageStates.semantic === 'active';
  const isSemanticSuccess = overallStatus === '✓ Semantic Analysis Passed' || stageStates.semantic === 'success';
  const isSemanticError  = overallStatus === '⚠ Semantic Errors Found' || stageStates.semantic === 'error';
  const isIrActive       = overallStatus === 'Generating Intermediate Representation...' || stageStates.ir === 'active';
  const isIrSuccess      = stageStates.ir === 'success';
  const isIrError        = overallStatus === '⚠ IR Generation Error' || stageStates.ir === 'error';
  const isSqlSuccess     = overallStatus === '✓ SQL Generation Complete' || stageStates.sql === 'success';
  const isSqlError       = overallStatus === '⚠ SQL Generation Error' || stageStates.sql === 'error';
  
  const isDbActive       = overallStatus === 'Executing query...' || stageStates.db === 'active';
  const isDbSuccess      = overallStatus === '✓ Database Execution Complete' || stageStates.db === 'success';
  const isDbError        = overallStatus === '⚠ Database Error' || overallStatus === '⚠ Database Connection Error' || stageStates.db === 'error';
  
  const isAstGenerated   = stageStates.ast === 'success';
  const isTreeComplete   = stageStates.parseTree === 'success';
  const parserSuccess    = stageStates.parser === 'success';
  const parserError      = stageStates.parser === 'error';
  const isReady          = overallStatus === 'Ready for analysis';

  return (
    <section className="pipeline-card" aria-labelledby="pipeline-heading">
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Workflow size={16} className="pipeline-title-icon" />
          <h2 id="pipeline-heading" className="pipeline-title">Compilation Pipeline</h2>
        </div>
        <div className="pipeline-meta">
          <span className="pipeline-count">8 Stages</span>
          <span className={`pipeline-status-text ${isCompiling || isDbActive ? 'compiling' : ''} ${isVisualizing || isBuildingTree || isSemanticActive || isIrActive ? 'visualizing' : ''} ${isReady ? 'ready' : ''}`}>
            {isCompiling ? (
              <>
                <Loader2 size={11} className="spinning" />
                <span>Compiling...</span>
              </>
            ) : isDbSuccess ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>Database Execution Complete</span>
              </>
            ) : isDbError ? (
              <>
                <AlertCircle size={11} className="error" />
                <span>Database Error</span>
              </>
            ) : isDbActive ? (
              <>
                <Loader2 size={11} className="spinning" />
                <span>Executing Query (08)</span>
              </>
            ) : isSqlSuccess ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>SQL Generation Complete</span>
              </>
            ) : isSqlError ? (
              <>
                <AlertCircle size={11} className="error" />
                <span>SQL Generation Error</span>
              </>
            ) : isIrSuccess ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>IR Generated</span>
              </>
            ) : isIrError ? (
              <>
                <AlertCircle size={11} className="error" />
                <span>IR Generation Error</span>
              </>
            ) : isIrActive ? (
              <>
                <Loader2 size={11} className="spinning" />
                <span>Generating IR (07)</span>
              </>
            ) : isSemanticSuccess ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>Semantic Analysis Passed</span>
              </>
            ) : isSemanticError ? (
              <>
                <AlertCircle size={11} className="error" />
                <span>Semantic Errors Found</span>
              </>
            ) : isSemanticActive ? (
              <>
                <Loader2 size={11} className="spinning" />
                <span>Analyzing Semantics (06)</span>
              </>
            ) : isAstGenerated ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>AST Generated</span>
              </>
            ) : isBuildingTree ? (
              <>
                <CircleDot size={11} className="stage-active-dot" />
                <span>Building Parse Tree (04)</span>
              </>
            ) : isTreeComplete ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>Parse Tree Constructed</span>
              </>
            ) : isVisualizing ? (
              <>
                <CircleDot size={11} className="stage-active-dot" />
                <span>Lexer Active (02)</span>
              </>
            ) : parserSuccess ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>Syntax Valid</span>
              </>
            ) : parserError ? (
              <>
                <AlertCircle size={11} className="error" />
                <span>Syntax Errors</span>
              </>
            ) : stageStates.lexer === 'success' ? (
              <>
                <CheckCircle2 size={11} className="success" />
                <span>Lexer Complete</span>
              </>
            ) : stageStates.lexer === 'error' ? (
              <>
                <AlertCircle size={11} className="error" />
                <span>Lexical Errors</span>
              </>
            ) : isReady ? (
              <span>Ready for analysis</span>
            ) : (
              <span>All stages idle</span>
            )}
          </span>
        </div>
      </div>

      <div className="pipeline-stages-container">
        <div className="pipeline-track">
          {stages.map((stage, index) => {
            const isLast = index === stages.length - 1;
            return (
              <React.Fragment key={stage.id}>
                <div 
                  className={`pipeline-stage-node stage-${stage.status} ${isCompiling ? 'pipeline-idle-sim' : ''}`}
                  title={`${stage.name}: ${stage.description}`}
                >
                  <div className="stage-header-row">
                    <span className="stage-num">{stage.num}</span>
                    <span className={`stage-status-pill status-${stage.status}`}>
                      {getStatusIcon(stage.status)}
                      <span className="status-name">
                        {stage.status.charAt(0).toUpperCase() + stage.status.slice(1)}
                      </span>
                    </span>
                  </div>

                  <div className="stage-body">
                    <h3 className="stage-name">{stage.name}</h3>
                    <p className="stage-role">{stage.role}</p>
                  </div>
                </div>

                {!isLast && (
                  <div className="pipeline-connector" aria-hidden="true">
                    <div className="connector-line"></div>
                    <ArrowRight size={13} className="connector-arrow" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

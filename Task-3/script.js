/**
 * Glassmorphic Calculator Core JavaScript Engine
 * Handles State, safe evaluation parsing, keyboard events, history sidebar, and themes.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // State Initialization
  // ==========================================================================
  let currentInput = '0';      // The active number being typed or running result
  let expression = '';        // The math formula built so far (e.g. "12 + 5 *")
  let isCalculated = false;   // Flag to clear display on next digit click after equals
  let history = JSON.parse(localStorage.getItem('calc_history')) || [];

  // DOM Elements
  const displayMain = document.getElementById('display-main');
  const displayHistory = document.getElementById('display-history');
  const keypad = document.getElementById('keypad');
  const themeToggle = document.getElementById('theme-toggle');
  const historyToggle = document.getElementById('history-toggle');
  const historySidebar = document.getElementById('history-sidebar');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');

  // ==========================================================================
  // Display & UI Rendering Utilities
  // ==========================================================================
  function updateDisplay() {
    displayMain.textContent = currentInput;

    // Convert internal operators to user-friendly symbols for display
    let formattedExpression = expression
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/-/g, ' − ')
      .replace(/\+/g, ' + ');
    
    displayHistory.textContent = formattedExpression;

    // Dynamic scale scaling for display values to prevent layout breaks
    displayMain.className = 'display-main'; // Reset classes
    if (currentInput.length > 16) {
      displayMain.classList.add('shrink-small');
    } else if (currentInput.length > 10) {
      displayMain.classList.add('shrink-medium');
    }
  }

  function showError() {
    currentInput = 'Error';
    expression = '';
    isCalculated = true;
    updateDisplay();
  }

  // ==========================================================================
  // Robust Custom Mathematical Parser (No eval())
  // ==========================================================================
  function safeEval(expressionStr) {
    // Strip spaces
    const str = expressionStr.replace(/\s+/g, '');
    if (!str) return 0;

    // Tokenize expression string into numbers and operators
    const tokens = [];
    let numberBuffer = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (/[0-9.]/.test(char)) {
        numberBuffer += char;
      } else if (/[+\-*/]/.test(char)) {
        if (numberBuffer) {
          tokens.push(parseFloat(numberBuffer));
          numberBuffer = '';
        }
        
        // Handle negative numbers (e.g. check if '-' is a sign rather than operator)
        if (char === '-' && (tokens.length === 0 || /[+\-*/]/.test(tokens[tokens.length - 1]))) {
          numberBuffer = '-';
        } else {
          tokens.push(char);
        }
      }
    }
    
    if (numberBuffer) {
      tokens.push(parseFloat(numberBuffer));
    }

    if (tokens.length === 0) return 0;

    // Pass 1: Handle high-precedence operators (* and /)
    const tempTokens = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        const left = tempTokens.pop();
        const right = tokens[i + 1];
        
        if (left === undefined || right === undefined) {
          return 'Error';
        }
        
        if (token === '/') {
          if (right === 0) return 'Error'; // Division by zero
          tempTokens.push(left / right);
        } else {
          tempTokens.push(left * right);
        }
        i++; // Skip right token
      } else {
        tempTokens.push(token);
      }
    }

    // Pass 2: Handle low-precedence operators (+ and -)
    if (tempTokens.length === 0) return 0;
    let result = tempTokens[0];
    if (typeof result !== 'number') return 'Error';

    for (let i = 1; i < tempTokens.length; i += 2) {
      const op = tempTokens[i];
      const right = tempTokens[i + 1];
      
      if (right === undefined || typeof right !== 'number') {
        return 'Error';
      }
      
      if (op === '+') {
        result += right;
      } else if (op === '-') {
        result -= right;
      } else {
        return 'Error';
      }
    }

    // Resolve JavaScript floating-point issues (e.g. 0.1 + 0.2 = 0.30000000000000004)
    if (typeof result === 'number' && !isNaN(result)) {
      result = Number(result.toFixed(10));
    }

    return result;
  }

  // ==========================================================================
  // Key Input Processor
  // ==========================================================================
  function processInput(type, val) {
    // If screen currently displays "Error", reset state on any input (unless it's clear)
    if (currentInput === 'Error' && type !== 'clear') {
      currentInput = '0';
      expression = '';
      isCalculated = false;
      if (type !== 'number' && type !== 'decimal') {
        updateDisplay();
        return;
      }
    }

    switch (type) {
      case 'clear':
        currentInput = '0';
        expression = '';
        isCalculated = false;
        break;

      case 'backspace':
        if (isCalculated) {
          expression = '';
          isCalculated = false;
        } else {
          currentInput = currentInput.slice(0, -1);
          if (currentInput === '' || currentInput === '-') {
            currentInput = '0';
          }
        }
        break;

      case 'number':
        if (isCalculated) {
          currentInput = val;
          expression = '';
          isCalculated = false;
        } else {
          if (currentInput === '0') {
            currentInput = val;
          } else if (currentInput === '-0') {
            currentInput = '-' + val;
          } else {
            currentInput += val;
          }
        }
        break;

      case 'decimal':
        if (isCalculated) {
          currentInput = '0.';
          expression = '';
          isCalculated = false;
        } else {
          if (!currentInput.includes('.')) {
            currentInput += '.';
          }
        }
        break;

      case 'operator':
        if (isCalculated) {
          expression = currentInput + ' ' + val + ' ';
          currentInput = '';
          isCalculated = false;
        } else {
          // If there is active input, append it and operator to expression
          if (currentInput !== '' && currentInput !== '-') {
            // Strip trailing decimal point before adding operator
            if (currentInput.endsWith('.')) {
              currentInput = currentInput.slice(0, -1);
            }
            expression += currentInput + ' ' + val + ' ';
            currentInput = '';
          }
          // If no active input but expression exists, user changed operator
          else if (currentInput === '' && expression !== '') {
            // Trim trailing space, remove previous operator, add new one
            expression = expression.trim().slice(0, -1).trim() + ' ' + val + ' ';
          }
          // If starting calculator with operator directly, treat prefix as 0
          else if (currentInput === '' || currentInput === '-') {
            expression = '0 ' + val + ' ';
            currentInput = '';
          }
        }
        break;

      case 'equals':
        if (expression === '') {
          // Nothing to evaluate, strip trailing decimal if exists
          if (currentInput.endsWith('.')) {
            currentInput = currentInput.slice(0, -1);
            updateDisplay();
          }
          return;
        }

        let finalExpr = expression;
        if (currentInput !== '' && currentInput !== '-') {
          if (currentInput.endsWith('.')) {
            currentInput = currentInput.slice(0, -1);
          }
          finalExpr += currentInput;
        } else {
          // Trailing operator cleanup: e.g. "12 + " -> "12"
          finalExpr = finalExpr.trim().slice(0, -1);
        }

        const result = safeEval(finalExpr);

        if (result === 'Error') {
          showError();
        } else {
          saveToHistory(finalExpr, result);
          currentInput = String(result);
          expression = '';
          isCalculated = true;
        }
        break;
      
      // Hidden toggle helper for keyboard
      case 'negate':
        if (currentInput !== '0') {
          if (currentInput.startsWith('-')) {
            currentInput = currentInput.substring(1);
          } else {
            currentInput = '-' + currentInput;
          }
        }
        break;
    }

    updateDisplay();
  }

  // ==========================================================================
  // Mouse & Touch Click Event Delegation
  // ==========================================================================
  keypad.addEventListener('click', (e) => {
    const keyBtn = e.target.closest('.key');
    if (!keyBtn) return;

    const type = keyBtn.dataset.type;
    const val = keyBtn.dataset.val;

    // Trigger visual scale animation (built into CSS active, but standardizing feel)
    processInput(type, val);
  });

  // ==========================================================================
  // Physical Keyboard Input Bindings
  // ==========================================================================
  window.addEventListener('keydown', (e) => {
    let key = e.key;
    let button = null;

    // Handle combinations and aliases
    if (key === 'Enter' || key === '=') {
      button = document.querySelector('[data-type="equals"]');
      e.preventDefault(); // Prevent focus selection click double trigger
    } else if (key === 'Escape') {
      button = document.querySelector('[data-type="clear"]');
    } else if (key === 'Backspace') {
      button = document.querySelector('[data-type="backspace"]');
    } else if (key === '*') {
      button = document.querySelector('[data-val="*"]');
    } else if (key === '/') {
      button = document.querySelector('[data-val="/"]');
    } else if (key === '-') {
      button = document.querySelector('[data-val="-"]');
    } else if (key === '+') {
      button = document.querySelector('[data-val="+"]');
    } else if (key === '.') {
      button = document.querySelector('[data-type="decimal"]');
    } else if (key >= '0' && key <= '9') {
      button = document.querySelector(`[data-val="${key}"]`);
    } else if (key === 'c' || key === 'C') {
      button = document.querySelector('[data-type="clear"]');
    } else if (key === 'n' || key === 'N') {
      // Secret key for negation toggle
      processInput('negate');
      return;
    }

    if (button) {
      button.classList.add('active-kb');
      const type = button.dataset.type;
      const val = button.dataset.val;
      processInput(type, val);
    }
  });

  window.addEventListener('keyup', (e) => {
    // Clear active classes from keys
    document.querySelectorAll('.key').forEach(btn => btn.classList.remove('active-kb'));
  });

  // ==========================================================================
  // History Logging sidebar Panel
  // ==========================================================================
  function saveToHistory(expr, result) {
    const formattedExpr = expr
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/-/g, ' − ')
      .replace(/\+/g, ' + ');

    const historyItem = {
      expr: formattedExpr,
      result: result
    };

    // Cap history at 30 items
    history.unshift(historyItem);
    if (history.length > 30) history.pop();

    localStorage.setItem('calc_history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-history-msg">No calculations yet</div>';
      return;
    }

    history.forEach((item, index) => {
      const historyItemDiv = document.createElement('div');
      historyItemDiv.className = 'history-item';
      historyItemDiv.dataset.index = index;
      historyItemDiv.setAttribute('role', 'button');
      historyItemDiv.setAttribute('tabindex', '0');
      historyItemDiv.setAttribute('aria-label', `Equation: ${item.expr} Result: ${item.result}`);

      historyItemDiv.innerHTML = `
        <div class="history-item-expr">${item.expr}</div>
        <div class="history-item-result">${item.result}</div>
      `;

      historyList.appendChild(historyItemDiv);
    });
  }

  // Load history result back into display on item click
  historyList.addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (!item) return;

    const index = parseInt(item.dataset.index);
    const selectedItem = history[index];
    
    if (selectedItem) {
      currentInput = String(selectedItem.result);
      expression = '';
      isCalculated = true; // Treats as calculated so typing numbers replaces it
      updateDisplay();
      
      // Close sidebar after selecting
      historySidebar.classList.remove('open');
    }
  });

  // Handle enter key accessibility for history list items
  historyList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const item = e.target.closest('.history-item');
      if (item) item.click();
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('calc_history');
    renderHistory();
  });

  // Toggle History Sidebar
  historyToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    historySidebar.classList.toggle('open');
  });

  // Close sidebar on outer container click
  document.addEventListener('click', (e) => {
    if (!historySidebar.contains(e.target) && e.target !== historyToggle && !historyToggle.contains(e.target)) {
      historySidebar.classList.remove('open');
    }
  });

  // ==========================================================================
  // Interactive Theme Control (Dark/Light Mode)
  // ==========================================================================
  function initTheme() {
    // 1. Check local storage
    const savedTheme = localStorage.getItem('calc_theme');
    
    // 2. Check system preferences
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('calc_theme', newTheme);
  });

  // Initialize
  initTheme();
  renderHistory();
  updateDisplay();
});

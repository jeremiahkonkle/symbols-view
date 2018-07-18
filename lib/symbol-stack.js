/** @babel */

export class SymbolStack {
  constructor(fileView, stack = []) {
      
    console.log('new symbol stack instance')
    
    this.fileView = fileView
    this.stack = stack
    this.editor = null
    this.cursorChangeSub = null
    this.onFocusSub = null
    this.lastUnfocusedPosition = null
    
    atom.workspace.onDidChangeActiveTextEditor(
      this.handleNewActiveEditor.bind(this)
    )
    
    this.handleNewActiveEditor(atom.workspace.getActiveTextEditor())
  }
  
  handleNewActiveEditor(editor) {
    console.log('setActiveEditor', editor)
    
    if (this.onFocusSub) {
      editorInputElement(this.editor)
        .removeEventListener('focus', this.onFocusSub)
    }
    this.onFocusSub = this.handleEditorFocus.bind(this)
    editorInputElement(editor).addEventListener('focus', this.onFocusSub)
    
    if (this.cursorChangeSub) {
      this.cursorChangeSub.dispose()
    }
    this.cursorChangeSub = editor.onDidChangeCursorPosition(
      this.handleNewCursorPositionEvent.bind(this)
    )
    
    if (this.lastUnfocusedPosition) {
      this.lastUnfocusedPosition = null
    }
    
    this.editor = editor
    this.handleNewCursorPosition(editor.getCursorBufferPosition())        
  }
  
  handleEditorFocus() {
    console.log('handleEditorFocus', 'lastU', this.lastUnfocusedPosition)
    if (this.lastUnfocusedPosition) {
      this.handleNewCursorPosition(this.lastUnfocusedPosition)
      this.lastUnfocusedPosition = null
    }
  }
  
  handleNewCursorPositionEvent(event) {
    this.handleNewCursorPosition(event.newBufferPosition)
  }
  
  handleNewCursorPosition(position) {
    const isFocused = (document.activeElement == editorInputElement(this.editor))
    console.log('handleNewCursorPosition', 'isFocused', isFocused)
    if (isFocused) {
      this.handleNewFocusedCursorPosition(position)
    } else {
      this.lastUnfocusedPosition = position
    }
  }
  
  handleNewFocusedCursorPosition(position) {
    // TODO SYMBOL STACK : debounce cursor position changes, 500ms?
    console.log('new cursor position', position)
    
    if (this.queuedFocusedCursorPosition) {
      clearTimeout(this.queuedFocusedCursorPosition)
    }
    
    handleStable = () => { this.handleStableFocusedCursorPosition(position) }
    this.queuedFocusedCursorPosition = setTimeout(handleStable, 500)
  }
  
  handleStableFocusedCursorPosition(position) {
    console.log('stable cursor position', position)
    const path = this.editor.getPath()
    const prev = this.stack.length ? this.stack[this.stack.length - 1] : null
    
    if (!prev || prev.path != path || prev.position.row != position.row) {
      this.fileView.getTags(path)
        .then((tags) => {
          const tag = findNearestTag(tags, position.row)
          console.log('nearestTag', tag)
          if (!prev ||
              (tag && prev.tag && !tag.position.isEqual(prev.tag.position)) ||
              (tag && !prev.tag) || (!tag && prev.tag)) {
                        
            this.stack = this.stack.filter((item) => {
              return (
                item.path != path ||
                (tag && item.tag && !tag.position.isEqual(item.tag.position)) ||
                (tag && !item.tag) || (!tag && item.tag)
              )
            })
            this.stack.push({path, tag, position})
            
            while (this.stack.length > 50) {
              this.stack.shift()
            }
            
            console.log('stack push', this.stack)
          }
        })
    } else if (prev && prev.position.column != position.column) {
      prev.position = position
    }
  }
}

function editorIsFocused(editor) {
  return editor.element.classList.contains('is-focused')
}

function editorInputElement(editor) {
  const matches = editor.element.getElementsByClassName('hidden-input')
  return matches[0]
}

function findNearestTag(tags, row) {
  let left = 0
  let right = tags.length-1
  
  while (left <= right) {
    const mid = (left + right) // 2
    const midRow = tags[mid].position.row

    if (row < midRow) {
      right = mid - 1
    } else {
      left = mid + 1
    }
  }

  const nearest = left - 1
  return tags[nearest]
}

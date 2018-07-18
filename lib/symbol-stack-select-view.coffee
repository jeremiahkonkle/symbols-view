fs = require 'fs-plus'
path = require 'path'
SelectListView = require 'atom-select-list'

module.exports =
class SymbolStackSelectView
  constructor: (symbolStack) ->
    @symbolStack = symbolStack

    @selectListView = new SelectListView({
      emptyMessage: 'No symbol history.',
      items: [],
      filterKeyForItem: (item) -> if item.tag then item.tag.name else item.path
      elementForItem: (item) ->
        element = document.createElement 'li'
        element.className = 'two-lines'
        name = if item.tag then item.tag.name else item.path
        [projectPath, relativePath] = atom.project.relativizePath(item.path)
        element.innerHTML = "
          <div class='primary-line'>#{name}</div>
          <div class='secondary-line path'>#{relativePath} (#{item.position.row})</div>
        "
        element
      didChangeSelection: (item) =>
        console.log('didChangeSelection')
        @open(item, {activate: false})
      didConfirmSelection: (item) =>
        console.log('didConfirmSelection')
        @cancel()
        @open(item, {activate: true})
      didCancelSelection: () =>
        console.log('didCancelSelection')
        @cancel()
    })

    @selectListView.element.classList.add('symbol-stack-select')

  dispose: ->
    @cancel()
    @selectListView.destroy()

  cancel: ->
    if (@initialState)
      @deserializeEditorState(@initialState)
      @initialState = null
    if @panel?
      @panel.destroy()
      @panel = null
    if @previouslyFocusedElement
      @previouslyFocusedElement.focus()
      @previouslyFocusedElement = null      

  attach: ->
    @previouslyFocusedElement = document.activeElement
    @initialState = @serializeEditorState()
    if not @panel?
      @panel = atom.workspace.addModalPanel({item: @selectListView})
    @selectListView.focus()
    @selectListView.reset()

  toggle: ->
    if @panel?
      @cancel()
    else
      items = [].concat(@symbolStack.stack).reverse()
      # TODO SYMBOL STACK : SELECT VIEW : show this original position
      items.shift()
      console.log('items', items)
      @selectListView.update({items: items})
      @attach()

  open: (item, {activate=false}) ->
    return unless item and item.path
    
    console.log('opening', item.path)
    atom.workspace.open(item.path, {activatePane: activate})
      .then ->
        console.log('going to', item.position)
        if textEditor = atom.workspace.getActiveTextEditor()
          textEditor.setCursorBufferPosition(item.position, autoscroll: false)
          textEditor.scrollToCursorPosition(center: true)
  
  serializeEditorState: () ->
    editor = atom.workspace.getActiveTextEditor()
    editorElement = atom.views.getView(editor)
    scrollTop = editorElement.getScrollTop()
    activePath = editor?.buffer.file?.path
    if activePath
      [projectPath, activePath] = atom.project.relativizePath(activePath)
    console.log('serializeEditorState', activePath, editor.getSelectedBufferRanges(), scrollTop)
    {
      path: activePath,
      bufferRanges: editor.getSelectedBufferRanges(),
      scrollTop,
    }

  deserializeEditorState: ({path, bufferRanges, scrollTop}) ->
    console.log('deserializeEditorState', path, bufferRanges, scrollTop)
    atom.workspace.open(path)
      .then ->
        if editor = atom.workspace.getActiveTextEditor()
          editorElement = atom.views.getView(editor)
          editor.setSelectedBufferRanges(bufferRanges)
          editorElement.setScrollTop(scrollTop)

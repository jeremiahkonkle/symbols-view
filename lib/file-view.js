/** @babel */

import { CompositeDisposable } from 'atom';
import SymbolsView from './symbols-view';
import TagGenerator from './tag-generator';
import TagParser from './tag-parser';
import { match } from 'fuzzaldrin';

export default class FileView extends SymbolsView {
  constructor(stack) {
    super(stack);
    this.cachedTags = {};
    this.watchedEditors = new WeakSet();

    this.editorsSubscription = atom.workspace.observeTextEditors(editor => {
      if (this.watchedEditors.has(editor)) return;

      const removeFromCache = () => {
        delete this.cachedTags[editor.getPath()];
      };
      const editorSubscriptions = new CompositeDisposable();
      editorSubscriptions.add(editor.onDidChangeGrammar(removeFromCache));
      editorSubscriptions.add(editor.onDidSave(removeFromCache));
      editorSubscriptions.add(editor.onDidChangePath(removeFromCache));
      editorSubscriptions.add(editor.getBuffer().onDidReload(removeFromCache));
      editorSubscriptions.add(editor.getBuffer().onDidDestroy(removeFromCache));
      editor.onDidDestroy(() => {
        this.watchedEditors.delete(editor);
        editorSubscriptions.dispose();
      });

      this.watchedEditors.add(editor);
    });
  }

  destroy() {
    this.editorsSubscription.dispose();
    return super.destroy();
  }

  elementForItem({position, name, level, icon}) {
    // Style matched characters in search results
    const matches = match(name, this.selectListView.getFilterQuery());
    
    let container = document.createElement('div');
    
    const primaryLine = document.createElement('div');
    primaryLine.classList.add('primary-line');
    primaryLine.classList.add('icon');
    primaryLine.classList.add(`${icon}`);
    primaryLine.appendChild(SymbolsView.highlightMatches(this, name, matches));
    container.appendChild(primaryLine);

    const secondaryLine = document.createElement('div');
    secondaryLine.classList.add('secondary-line');
    secondaryLine.classList.add('no-icon');
    secondaryLine.textContent = `Line ${position.row + 1}`;
    container.appendChild(secondaryLine);

    for (let i = 0; i < level; i++) {
      const bq = document.createElement('blockquote');
      bq.classList.add('symbol-level-indent');
      bq.appendChild(container);
      container = bq
    }

    const li = document.createElement('li');    
    li.classList.add('two-lines');
    li.appendChild(container)

    return li;
  }

  didChangeSelection(item) {
    if (atom.config.get('symbols-view.quickJumpToFileSymbol') && item) {
      this.openTag(item);
    }
  }

  async didCancelSelection() {
    await this.cancel();
    const editor = this.getEditor();
    if (this.initialState && editor) {
      this.deserializeEditorState(editor, this.initialState);
    }
    this.initialState = null;
  }

  async toggle() {
    if (this.panel.isVisible()) {
      await this.cancel();
    }
    const filePath = this.getPath();
    if (filePath) {
      const editor = this.getEditor();
      if (atom.config.get('symbols-view.quickJumpToFileSymbol') && editor) {
        this.initialState = this.serializeEditorState(editor);
      }
      this.populate(filePath);
      this.attach();
    }
  }

  serializeEditorState(editor) {
    const editorElement = atom.views.getView(editor);
    const scrollTop = editorElement.getScrollTop();

    return {
      bufferRanges: editor.getSelectedBufferRanges(),
      scrollTop,
    };
  }

  deserializeEditorState(editor, {bufferRanges, scrollTop}) {
    const editorElement = atom.views.getView(editor);

    editor.setSelectedBufferRanges(bufferRanges);
    editorElement.setScrollTop(scrollTop);
  }

  getEditor() {
    return atom.workspace.getActiveTextEditor();
  }

  getPath() {
    if (this.getEditor()) {
      return this.getEditor().getPath();
    }
    return undefined;
  }

  getScopeName() {
    if (this.getEditor() && this.getEditor().getGrammar()) {
      return this.getEditor().getGrammar().scopeName;
    }
    return undefined;
  }

  async populate(filePath) {
    const row = this.getEditor().getCursorBufferPosition().row

    await this.selectListView.update({
      items: [],
      loadingMessage: 'Generating symbols\u2026',
    });
    const items = await this.getItems(filePath)
    await this.selectListView.update({
      items: items,
      loadingMessage: null,
    });
    
    console.log('row', row);
    const parser = new TagParser(
      await this.getTags(filePath), this.getScopeName()
    );
    nearestTag = parser.getNearestTag(row);
    console.log('nearestTag', nearestTag);
    for (let i = 0; i < items.length; i++) {
      if (items[i].name == nearestTag.name) {
        console.log('select index', i)
        this.selectListView.selectIndex(i);
        break;
      }
    }
  }
  
  async getItems(filePath) {
    const tags = await this.getTags(filePath);
    parser = new TagParser(tags, this.getScopeName())
    console.log(tags)
    const tree = parser.flatTree()
    console.log(tree)
    return tree
  }
  
  async getTags(filePath) {
    if (!this.cachedTags[filePath]) {
      this.cachedTags[filePath] = await this.generateTags(filePath)
    }
    return this.cachedTags[filePath]
  }

  async generateTags(filePath) {
    const generator = new TagGenerator(filePath, this.getScopeName());
    return await generator.generate();
  }
}

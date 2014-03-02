var Subscriber, AtomJshint;
var JSHINT = require('./vendor/jshint').JSHINT;
var Subscriber = require('emissary').Subscriber;
var fs = require('fs');

module.exports = AtomJshint = (function(){

  function AtomJsHint(){
    atom.workspace.eachEditor((function(self) {
      return function(editor) {
        return self.handleEvents(editor);
      };
    })(this));
    this.config = {globals:{},options:{}};
    this.loadConfig();
  }
  Subscriber.includeInto(AtomJsHint);

  AtomJsHint.prototype.destroy = function(){
    return this.unsubscribe();
  };

  AtomJsHint.prototype.handleEvents = function(editor) {
    var buffer = editor.getBuffer();
    this.subscribe(buffer, 'saved', (function(self) {
      return function() {
        if( atom.config.get('atom-jshint.hintOnSave') ){
          return buffer.transact(function() {
            self.run(editor);
          });
        }
      };
    })(this));
    this.subscribe(buffer, 'destroyed', (function(self) {
      return function() {
        return self.unsubscribe(buffer);
      };
    })(this));
  };

  AtomJsHint.prototype.run = function(editor){
    var self = this;
    var text = this.getContents();
    if( !text ) return;
    if( !JSHINT(text, this.config.options, this.config.globals) ){
      var jsHintErrors = JSHINT.errors.filter(function (error) { return error !== null; });
      self.updateStatus(jsHintErrors, editor.cursors[0].getBufferRow());
      self.updateGutter(jsHintErrors);
      this.subscribe(atom.workspaceView, 'cursor:moved', function () {
        self.updateStatus(jsHintErrors, editor.cursors[0].getBufferRow());
      });
      this.subscribe(editor, 'scroll-top-changed', function () {
        self.updateGutter(jsHintErrors);
      });
    } else {
      self.updateStatus(false);
      self.updateGutter([]);
      self.unsubscribe(atom.workspaceView);
      self.unsubscribe(editor);
    }
  };

  AtomJsHint.prototype.updateGutter = function(errors){
    atom.workspaceView.eachEditorView(function(editorView){
      if (editorView.active) {
        var gutter = editorView.gutter;
        gutter.removeClassFromAllLines('atom-jshint-error');
        errors.forEach(function(error){
          gutter.addClassToLine(error.line - 1, 'atom-jshint-error');
        });
      }
    });
  };

  AtomJsHint.prototype.updateStatus = function(errors, row){
    var status = document.getElementById('jshint-status');
    if( status ) status.parentElement.removeChild(status);
    if( !errors ) return;
    var msg = errors.length > 0 ? errors.length + ' JSHint error' + (errors.length>1?'s':'') : '';
    if (row >= 0) {
      var lineErrors = errors.filter(function (error) {
        return error.line === row + 1;
      });
      if (lineErrors.length > 0) {
        msg += '; Line: ' + (row + 1) + ': ' + lineErrors[0].reason;
        atom.workspaceView.statusBar.appendLeft('<span id="jshint-status">' + msg + '</span>');
        return;
      }
    }
    atom.workspaceView.statusBar.appendLeft('<span id="jshint-status">' + msg + '</span>');
  };


  AtomJsHint.prototype.getContents = function(){
    var filename = atom.workspace.activePaneItem.getUri();
    if( filename.slice(-3) !== '.js' ) return false;
    var text = atom.workspace.activePaneItem.getText();
    if( !text ) return false;
    return text;
  };

  AtomJsHint.prototype.loadConfig = function(){
    if( fs.existsSync(atom.project.path + '/package.json') ){
      var packageJson = require(atom.project.path + '/package.json');
      if( packageJson.jshintConfig ) {
        return this.setConfig(packageJson.jshintConfig);
      }
    }
    if( fs.existsSync(atom.project.path + '/.jshintrc') ){
      var configFile = fs.readFileSync(atom.project.path + '/.jshintrc','UTF8');
      var conf = {};
      try {
        conf = JSON.parse(configFile);
      } catch(e){
        console.error('error parsing config file');
      }
      return this.setConfig(conf);
    }
  };

  AtomJsHint.prototype.setConfig = function(conf){
    var config = {globals:{},options:{}};
    config.globals = conf.globals || {};
    if( conf.global ) { delete conf.globals; }
    config.options = conf;
    this.config = config;
  };

  return AtomJsHint;

})();

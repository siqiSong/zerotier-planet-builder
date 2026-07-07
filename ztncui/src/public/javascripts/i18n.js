(function() {
  var messages = window.ZTNCUI_I18N || {};
  var patterns = messages.__patterns || [];
  delete messages.__patterns;
  var keys = Object.keys(messages);
  if (!keys.length) return;

  function translateText(value) {
    var trimmed = value.trim();
    if (!trimmed) return value;
    if (messages[trimmed]) return value.replace(trimmed, messages[trimmed]);
    for (var i = 0; i < patterns.length; i++) {
      var pattern = new RegExp(patterns[i][0]);
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, patterns[i][1]));
    }
    return value;
  }

  function translateAttributes(root) {
    var elements = root.querySelectorAll('[placeholder], [title], [value]');
    Array.prototype.forEach.call(elements, function(element) {
      ['placeholder', 'title', 'value'].forEach(function(name) {
        var value = element.getAttribute(name);
        if (value && messages[value]) element.setAttribute(name, messages[value]);
      });
    });
  }

  function translateTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentNode.nodeName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node) {
      node.nodeValue = translateText(node.nodeValue);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    translateAttributes(document);
    translateTextNodes(document.body);
  });
})();

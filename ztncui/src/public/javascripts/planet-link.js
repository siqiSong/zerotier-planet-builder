(function() {
  function t(value) {
    var messages = window.ZTNCUI_I18N || {};
    return messages[value] || value;
  }

  function fallbackCopy(value) {
    return new Promise(function(resolve, reject) {
      var input = document.createElement('input');
      input.type = 'text';
      input.value = value;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      try {
        if (document.execCommand('copy')) {
          resolve();
        } else {
          reject(new Error('copy command failed'));
        }
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(input);
      }
    });
  }

  function copyWithFallback(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).catch(function() {
        return fallbackCopy(value);
      });
    }

    return fallbackCopy(value);
  }

  function setButtonText(button, text) {
    button.textContent = text;
  }

  document.addEventListener('DOMContentLoaded', function() {
    var links = document.querySelectorAll('.planet-download-link');
    Array.prototype.forEach.call(links, function(link) {
      var container = link.parentNode;
      var url = link.href;
      var urlText = container.querySelector('.planet-url-text');
      var button = container.querySelector('[data-planet-copy]');
      if (urlText) urlText.textContent = url;
      if (!button) return;

      setButtonText(button, t('Copy link'));
      button.addEventListener('click', function() {
        copyWithFallback(url).then(function() {
          setButtonText(button, t('Copied'));
          setTimeout(function() {
            setButtonText(button, t('Copy link'));
          }, 1500);
        }).catch(function() {
          setButtonText(button, t('Copy failed'));
          setTimeout(function() {
            setButtonText(button, t('Copy link'));
          }, 1500);
        });
      });
    });
  });
})();

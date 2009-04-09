/* $Id$ */

/** 
 * @projectDescription An implementation of the <canvas> text functions in browsers that don't already have it
 * @author Fabien Ménager
 * @version $Revision$
 * @license MIT License <http://www.opensource.org/licenses/mit-license.php>
 */

/**
 * Known issues:
 * - The 'light' font weight is not supported, neither is the 'oblique' font style.
 * - Optimize the different hacks (for Safari3 and Opera9)
 */

/** Array.indexOf */
if (!Array.prototype.indexOf) Array.prototype.indexOf = function(item, i) {
  i || (i = 0);
  var length = this.length;
  if (i < 0) i = length + i;
  for (; i < length; i++) if (this[i] === item) return i;
  return -1;
};

window.Canvas = window.Canvas || {};
window.Canvas.Text = {
  // http://mondaybynoon.com/2007/04/02/linux-font-equivalents-to-popular-web-typefaces/
  equivalentFaces: {
    'Arial': ['Utkal', 'Nimbus Sans L', 'FreeSans', 'Malayalam', 'Phetsarath OT'],
    'Charcoal': ['Rehka', 'Aakar', 'FreeSerif', 'Gentium'],
    'Comic Sans MS': ['TSCu_Comic'],
    'Courier New': ['FreeMono', 'Nimbus Mono L'],
    'Georgia': ['Nimbus Roman No9 L', 'Century Schoolbook L', 'Norasi', 'Rekha'],
    'Helvetica': ['FreeSans', 'Gargi_1.7', 'Jamrul', 'Malayalam', 'Mukti Narrow', 'Nimbus Sans L', 'Phetsarath OT'],
    'Lucida Grande': ['Gargi_1.7', 'Garuda', 'Jamrul', 'Loma', 'Malayalam', 'Mukti Narrow'],
    'Tahoma': ['Kalimati'],
    'Times New Roman': ['FreeSerif'],
    'Verdana': ['Kalimati']
  },

  // http://www.w3.org/TR/CSS21/fonts.html#generic-font-families
  genericFaces: {
    'serif': ['Times New Roman', 'Bodoni', 'Garamond', 'Minion Web', 'ITC Stone Serif', 'Georgia', 'Bitstream Cyberbit'],
    'sans-serif': ['Trebuchet', 'Verdana', 'Arial', 'Tahoma', 'Helvetica', 'ITC Avant Garde Gothic', 'Univers', 'Futura', 
                   'Gill Sans', 'Akzidenz Grotesk', 'Attika', 'Typiko New Era', 'ITC Stone Sans', 'Monotype Gill Sans 571'],
    'monospace': ['Courier', 'Courier New', 'Prestige', 'Everson Mono'],
    'cursive': ['Caflisch Script', 'Adobe Poetica', 'Sanvito', 'Ex Ponto', 'Snell Roundhand', 'Zapf-Chancery'],
    'fantasy': ['Alpha Geometrique', 'Critter', 'Cottonwood', 'FB Reactor', 'Studz']
  }
};

/** Initializes a canvas element for Internet Explorer if 
 * ExCanvas is present and old-webkit based browsers
 * @param {Element} canvas The canvas to initialize
 */
function initCanvas(canvas) {
  if (window.G_vmlCanvasManager && window.attachEvent && !window.opera) {
    canvas = window.G_vmlCanvasManager.initElement(canvas);
  }
  return canvas;
}

/** The implementation of the text functions */
(function(){
  var isOpera9 = (window.opera && navigator.userAgent.match(/Opera\/9/)),
      isSafari3 = !window.CanvasRenderingContext2D,
      proto = window.CanvasRenderingContext2D ? window.CanvasRenderingContext2D.prototype : document.createElement('canvas').getContext('2d').__proto__,
      ctxt = window.Canvas.Text;

  // Global options
  ctxt.options = {
    fallbackCharacter: ' ', // The character that will be drawn when not present in the font face file
    dontUseMoz: false, // Don't use the builtin Firefox 3.0 functions (mozDrawText, mozPathText and mozMeasureText)
    reimplement: false, // Don't use the builtin official functions present in Chrome 2, Safari 4, and Firefox 3.1+
    debug: false // Debug mode, not used yet
  };
  
  function initialize(){
    var libFileName = 'canvas.text.js',
        head = document.getElementsByTagName("head")[0],
        scripts = head.getElementsByTagName("script"), i, j, src, parts;

    for (i = 0; i < scripts.length; i++) {
      src = scripts[i].src;
      if (src.indexOf(libFileName) > 0) {
        parts = src.split('?');
        ctxt.basePath = parts[0].replace(libFileName, '');
        if (parts[1]) {
          var options = parts[1].split('&');
          for (j = options.length-1; j >= 0; --j) {
            var pair = options[j].split('=');
            ctxt.options[pair[0]] = pair[1];
          }
        }
        break;
      }
    }
  };
  initialize();
  
  // What is the browser's implementation ?
  var moz = !ctxt.options.dontUseMoz && proto.mozDrawText && !proto.strokeText;

  // If the text functions are already here : nothing to do !
  if (proto.strokeText && !ctxt.options.reimplement) return;
  
  function getCSSWeightEquivalent(weight) {
    switch(weight) {
      case 'bolder':
      case 'bold':
      case '900':
      case '800':
      case '700': return 'bold';
      case '600':
      case '500':
      case '400':
      default:
      case 'normal': return 'normal';
      //default: return 'light';
    }
  };
  
  function getElementStyle(e) {
    if (window.getComputedStyle)
      return window.getComputedStyle(e, '');
    else if (e.currentStyle)
      return e.currentStyle;
  };
  
  function getXHR() {
    var methods = [
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ];
    if (!ctxt.xhr) {
      for (i = 0; i < methods.length; i++) {
        try {
          ctxt.xhr = methods[i](); 
          break;
        } 
        catch (e) {}
      }
    }
    return ctxt.xhr;
  };
  
  ctxt.faces = {};
  ctxt.scaling = 0.962;
  ctxt._styleCache = {};

  ctxt.getFace = function(family, weight, style) {
    if (ctxt.faces[family] && 
        ctxt.faces[family][weight] && 
        ctxt.faces[family][weight][style]) return ctxt.faces[family][weight][style];
        
    var faceName = (family.replace('-', '')+'-'+weight+'-'+style).replace(' ', '_'),
        xhr = ctxt.xhr,
        url = ctxt.basePath+'faces/'+faceName+'.js';

    xhr = getXHR();
    xhr.open("get", url, false);
    xhr.send(null);
    if(xhr.status == 200) {
      eval(xhr.responseText);
      return ctxt.faces[family][weight][style];
    }
    else throw 'Unable to load the font ['+family+' '+weight+' '+style+']';
    return false;
  };
  
  ctxt.loadFace = function(data) {
    var family = data.familyName.toLowerCase(), ctxt = window.Canvas.Text;
    ctxt.faces[family] = ctxt.faces[family] || {};
    ctxt.faces[family][data.cssFontWeight] = ctxt.faces[family][data.cssFontWeight] || {};
    ctxt.faces[family][data.cssFontWeight][data.cssFontStyle] = data;
    return data;
  };
  // To use the typeface.js face files
  window._typeface_js = {faces: window.Canvas.Text.faces, loadFace: window.Canvas.Text.loadFace};
  
  ctxt.getFaceFromStyle = function(style) {
    var face, 
        weight = getCSSWeightEquivalent(style.weight),
        family = style.family.toLowerCase();
        
    return window.Canvas.Text.getFace(family, weight, style.style);
  };
  
  // Default values
  proto.font = "10px sans-serif";
  proto.textAlign = "start";
  proto.textBaseline = "alphabetic";
  
  proto.parseStyle = function(styleText) {
    styleText = styleText.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); // trim
    
    if (window.Canvas.Text._styleCache[styleText]) return this.getComputedStyle(window.Canvas.Text._styleCache[styleText]);
    
    var parts, lex = [], i, part,
    // Default style
    style = {
      family: 'sans-serif',
      size: 10,
      weight: 'normal',
      style: 'normal'
    };
    
    var possibleValues = {
      weight: ['bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      style: ['italic'/*, 'oblique'*/]
    };
    
    parts = styleText.match(/([\w\%-_]+|"[^"]+"|'[^']+')*/g);
    for(i = 0; i < parts.length; i++) {
      part = parts[i].replace(/^["']/, '').replace(/["']*$/, '');
      if (part) lex.push(part); 
    }
    
    style.family = lex.pop() || style.family;
    style.size = lex.pop() || style.size;
    
    for (var p in possibleValues) {
      var v = possibleValues[p];
      for (i = 0; i < v.length; i++) {
        if (lex.indexOf(v[i]) != -1) {
          style[p] = v[i];
          break;
        }
      }
    }
    
    return this.getComputedStyle(window.Canvas.Text._styleCache[styleText] = style);
  };
  
  proto.buildStyle = function (style) {
    return style.style+' '+style.weight+' '+style.size+'px "'+style.family+'"';
  };

  proto.renderText = function(text, style) {
    var face = window.Canvas.Text.getFaceFromStyle(style),
        scale = (style.size / face.resolution) * (3/4),
        offset = 0;
    
    if (!isOpera9) {
      this.scale(scale, -scale);
      this.lineWidth /= scale;
    }
    
    var i, chars = text.split(''), length = chars.length;
    for (i = 0; i < length; i++) {
      offset += this.renderGlyph(chars[i], face, scale, offset);
    }
  };

  if (isOpera9) {
    proto.renderGlyph = function(c, face, scale, offset) {
      var i, cpx, cpy, outline, action, glyph = face.glyphs[c], length;
      
      if (!glyph) return;
  
      if (glyph.o) {
        outline = glyph._cachedOutline || (glyph._cachedOutline = glyph.o.split(' '));
        length = outline.length;
        for (i = 0; i < length; ) {
          action = outline[i++];
  
          switch(action) {
            case 'm':
              this.moveTo(outline[i++]*scale+offset, outline[i++]*-scale);
              break;
            case 'l':
              this.lineTo(outline[i++]*scale+offset, outline[i++]*-scale);
              break;
            case 'q':
              cpx = outline[i++]*scale+offset;
              cpy = outline[i++]*-scale;
              this.quadraticCurveTo(outline[i++]*scale+offset, outline[i++]*-scale, cpx, cpy);
              break;
          }
        }
      }
      return glyph.ha*scale;
    };
  }
  else {
    proto.renderGlyph = function(c, face) {
      var i, cpx, cpy, outline, action, glyph = face.glyphs[c], length;
      
      if (!glyph) return;

      if (glyph.o) {
        outline = glyph._cachedOutline || (glyph._cachedOutline = glyph.o.split(' '));
        length = outline.length;

        for (i = 0; i < length; ) {
          action = outline[i++];
 
          switch(action) {
            case 'm':
              this.moveTo(outline[i++], outline[i++]);
              break;
            case 'l':
              this.lineTo(outline[i++], outline[i++]);
              break;
            case 'q':
              cpx = outline[i++];
              cpy = outline[i++];
              this.quadraticCurveTo(outline[i++], outline[i++], cpx, cpy);
              break;
          }
        }
      }
      if (glyph.ha) this.translate(glyph.ha, 0);
    };
  }
  
  proto.getTextExtents = function(text, style){
    var width = 0, 
        height = 0, horizontalAdvance = 0, 
        face = window.Canvas.Text.getFaceFromStyle(style),
        i, glyph;
    
    for (i = text.length - 1; i > 0; --i) {
      glyph = face.glyphs[text.charAt(i)] || face.glyphs[window.Canvas.Text.options.fallbackCharacter];
      width += Math.max(glyph.ha, glyph.x_max);
      horizontalAdvance += glyph.ha;
    }
    
    return {
      width: width,
      height: height,
      ha: horizontalAdvance
    };
  };
  
  proto.getComputedStyle = function(style) {
    var p, canvasStyle = getElementStyle(this.canvas), 
        computedStyle = {};
    
    for (p in style) {
      computedStyle[p] = style[p];
    }
    
    // Text align
    if (this.textAlign.match(/^(left|center|right)$/i)) {
      computedStyle.align = this.textAlign;
    } 
    else {
      computedStyle.align = (
        ((this.textAlign === 'end' && canvasStyle.direction == 'ltr') || 
         (this.textAlign === 'start' && canvasStyle.direction == 'rtl')) ? 'right' : 'left');
    }
    
    // Compute the size
    var canvasFontSize = parseFloat(canvasStyle.fontSize),
        fontSize = parseFloat(style.size);

    if (typeof style.size == 'number') 
      computedStyle.size = canvasFontSize;
    else if (style.size.indexOf('em') != -1)
      computedStyle.size = canvasFontSize * fontSize;
    else if(style.size.indexOf('%') != -1)
      computedStyle.size = (canvasFontSize / 100) * fontSize;
    else if (style.size.indexOf('pt') != -1)
      computedStyle.size = canvasFontSize * (4/3) * fontSize;
    else
      computedStyle.size = canvasFontSize;
    
    return computedStyle;
  };
  
  proto.getTextOffset = function(text, style) {
    var canvasStyle = getElementStyle(this.canvas),
        metrics = this.measureText(text), 
        offset = {x: 0, y: 0},
        face = window.Canvas.Text.getFaceFromStyle(style),
        scale = (style.size / face.resolution) * (3/4);

    switch (this.textAlign) {
      default:
      case null:
      case 'left': break;
      case 'center': offset.x = -metrics.width/2; break;
      case 'right':  offset.x = -metrics.width; break;
      case 'start':  offset.x = (canvasStyle.direction == 'rtl') ? -metrics.width : 0; break;
      case 'end':    offset.x = (canvasStyle.direction == 'ltr') ? -metrics.width : 0; break;
    }
    
    switch (this.textBaseline) {
      case 'hanging': 
      case 'top': offset.y = face.ascender; break;
      case 'middle': offset.y = (face.ascender + face.descender) / 2;
      default:
      case null:
      case 'alphabetic':
      case 'ideographic': break;
      case 'bottom': offset.y = face.descender; break;
    }
    offset.y *= scale;
    return offset;
  };
  
  proto.beginText = function(text, x, y, maxWidth, style){
    text = text || '';
    var offset = this.getTextOffset(text, style);
    
    this.save();
    this.translate(x + offset.x, y + offset.y);
    this.beginPath();
  };
  
  proto.fillText = function(text, x, y, maxWidth){
    var style = this.parseStyle(this.font);
    
    text = text || '';
    
    this.beginText(text, x, y , maxWidth, style);
    
    if (moz) {
      this.mozTextStyle = this.buildStyle(style);
      this.mozDrawText(text);
    }
    else {
      this.scale(window.Canvas.Text.scaling, window.Canvas.Text.scaling);
      this.renderText(text, style);
    }
    
    this.closePath();
    this.fill();
    this.restore();
  };
  
  proto.strokeText = function(text, x, y, maxWidth){
    var style = this.parseStyle(this.font);
    
    text = text || '';
    
    this.beginText(text, x, y , maxWidth, style);
    
    if (moz) {
      this.mozTextStyle = this.buildStyle(style);
      this.mozPathText(text);
    }
    else {
      this.scale(window.Canvas.Text.scaling, window.Canvas.Text.scaling);
      this.renderText(text, style);
    }
    
    this.closePath();
    this.stroke();
    this.restore();
  };
  
  proto.measureText = function(text){
    var style = this.parseStyle(this.font), 
        dim = {width: 0};
    
    text = text || '';
    
    if (moz) {
      this.mozTextStyle = this.buildStyle(style);
      dim.width = this.mozMeasureText(text);
    }
    else {
      var face = window.Canvas.Text.getFaceFromStyle(style),
          scale = (style.size / face.resolution) * (3/4);
          
      dim = this.getTextExtents(text, style);
      dim.width *= scale * window.Canvas.Text.scaling;
    }
    
    return dim;
  };
})();
if (!Array.prototype.indexOf) Array.prototype.indexOf = function(item, i) {
  i || (i = 0);
  var length = this.length;
  if (i < 0) i = length + i;
  for (; i < length; i++)
    if (this[i] === item) return i;
  return -1;
};

if (!Function.prototype.bind) Function.prototype.bind = function(){ 
  var fn = this, args = Array.prototype.slice.call(arguments), object = args.shift(); 

  return function() {
    return fn.apply(object, args.concat(Array.prototype.slice.call(arguments))); 
  }; 
};

function initCanvas(canvas) {
  if (window.G_vmlCanvasManager && window.attachEvent && !window.opera) {
    canvas = window.G_vmlCanvasManager.initElement(canvas);
  }
	// WIP for safari 3 and chrome 1.0
	else if (window.safari3) {
		var f, 
		    textFunctions = window.window.Canvas.Text,
		    canvasContext = canvas.getContext('2d');

		for(f in textFunctions) {
      canvasContext[f] = ((typeof textFunctions[f] == 'function') ? textFunctions[f].bind(canvasContext) : textFunctions[f]);
    }
	}
	return canvas;
}

(function(){
	window.Canvas = {Text: {}};
	
  var textFunctions = window.Canvas.Text,
	    ctx = window.CanvasRenderingContext2D,
			ctxp = ctx.prototype;

  // what is the browser's implementation ?
	var moz = ctxp.mozDrawText && !ctxp.strokeText;

  if (ctxp.strokeText) return;
	
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
			case 'normal': return 'normal';
      default: return 'light';
		}
  };
	
	function getElementStyle(e) {
    if (window.getComputedStyle) {
      return window.getComputedStyle(e, '');
    } else if (e.currentStyle) {
      return e.currentStyle;
    }
  };
	
	function getXHR() {
		var methods = [
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ];
		if (!ctx.xhr) {
      for (i = 0; i < methods.length; i++) {
        try {
          ctx.xhr = methods[i](); 
					break;
        } 
        catch (e) {}
      }
    }
		return ctx.xhr;
	};
	
  ctx.fallbackCharacter = " ";
  ctx.faces = {};
	ctx.scaling = 0.962;
  ctx._styleCache = {};
  ctx.getFace = function(family, weight, style) {
    var i, libFileName = 'canvas.text.js',
        faceName = (family+'-'+weight+'-'+style).replace(' ', '_');
    
    if (ctx.faces[family] && 
        ctx.faces[family][weight] && 
        ctx.faces[family][weight][style]) return ctx.faces[family][weight][style];
    
    if (!ctx.basePath){
      var head = document.getElementsByTagName("head")[0],
          scripts = head.getElementsByTagName("script"), i, j, src, parts;

      for (i = 0; i < scripts.length; i++) {
        src = scripts[i].src;
        if (src.indexOf(libFileName) > 0) {
          parts = src.split("?");
          ctx.basePath = parts[0].replace(libFileName, '');
        }
      }
    }
    
    ctx.xhr = getXHR();
    ctx.xhr.open("get", ctx.basePath+'faces/'+faceName+'.js', false);
    ctx.xhr.send(null);
    if (ctx.xhr.status == 200) {
      window.eval(ctx.xhr.responseText);
      return ctx.faces[family][weight][style];
    }
    return false;
  };
  
  ctx.loadFace = function(data) {
    var familyName = data.familyName.toLowerCase();
    ctx.faces[familyName] = ctx.faces[familyName] || {};
    ctx.faces[familyName][data.cssFontWeight] = ctx.faces[familyName][data.cssFontWeight] || {};
    ctx.faces[familyName][data.cssFontWeight][data.cssFontStyle] = data;
    return data;
  };
  window._typeface_js = {faces: ctx.faces, loadFace: ctx.loadFace};
  
  ctx.getFaceFromStyle = function(style) {
    var face, scale, weight = getCSSWeightEquivalent(style.weight),
        familyName = style.family.toLowerCase();
        
    if (!ctx.faces[familyName] ||
        !ctx.faces[familyName][weight] ||
        !ctx.faces[familyName][weight][style.style]) {
      face = ctx.getFace(familyName, weight, style.style);
    }
    else {
      face = ctx.faces[familyName][weight][style.style];
    }
    if (!face) {
      throw 'Unable to load the font ['+style.family+' '+style.weight+' '+style.style+']';
      return false;
    }
    return face;
  };
	
  ctxp.font = "10px sans-serif";
  ctxp.textAlign = "start";
  ctxp.textBaseline = "alphabetic";
  ctxp.parseStyle = function(styleText) {
    styleText = styleText.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); // trim
    
    if (ctx._styleCache[styleText]) return this.getComputedStyle(ctx._styleCache[styleText]);
    
    var parts, lex = [], i, 
    // Default style
    style = {
      family: 'sans-serif',
      size: 10,
      weight: 'normal',
      style: 'normal'
    };
    
    var possibleValues = {
      weight: ['bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      style: ['italic', 'oblique']
    };
    
    parts = styleText.match(/([\w\%]+|"[^"]+"|'[^']+')*/g);
    for(i = 0; i < parts.length; i++) {
      parts[i] = parts[i].replace(/^["|']/, '').replace(/["|']*$/, '');
      if (parts[i]) lex.push(parts[i]); 
    }
    
    style.family = lex.pop() || style.family;
    style.size = lex.pop() || style.size;
    
    for (var p in possibleValues) {
      for (i = 0; i < possibleValues[p].length; i++) {
        if (lex.indexOf(possibleValues[p][i]) != -1) {
          style[p] = possibleValues[p][i];
          break;
        }
      }
    }
		
    return this.getComputedStyle(ctx._styleCache[styleText] = style);
  };
  
  ctxp.buildStyle = function (style) {
    return style.style+' '+style.weight+' '+style.size+'px "'+style.family+'"';
  };

	ctxp.renderText = function(text, style) {
    var face = ctx.getFaceFromStyle(style),
		    scale = (style.size / face.resolution) * (3/4);
		
    this.beginPath();
    this.save();
		this.scale(scale, -scale);

    var i, chars = text.split('');
    for (i = 0; i < chars.length; i++) {
      this.renderGlyph(chars[i], face);
    }
		
		this.restore();
		this.closePath();
	};
	
	ctxp.renderGlyph = function(c, face) {
    var i, cpx, cpy, outline, action, glyph = face.glyphs[c];
    
		if (!glyph) return;

    if (glyph.o) {
      outline = glyph._cachedOutline || (glyph._cachedOutline = glyph.o.split(' '));

      for (i = 0; i < outline.length; ) {
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
    if (glyph.ha) {
      this.translate(glyph.ha, 0);
    }
	};
	
  ctxp.getTextExtents = function(text, style){
    var width = 0, 
		    height = 0, horizontalAdvance = 0, 
				face = ctx.getFaceFromStyle(style),
				i, glyph;
    
    for (i = 0; i < text.length; i++) {
      glyph = face.glyphs[text.charAt(i)] || face.glyphs[this.fallbackCharacter];
      width += Math.max(glyph.ha, glyph.x_max);
      horizontalAdvance += glyph.ha;
    }
		
    return {
      width: width,
      height: height,
      ha: horizontalAdvance
    };
  };
	
	ctxp.getComputedStyle = function(style) {
		var canvasStyle = getElementStyle(this.canvas), 
		    computedStyle = style;
		
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
	
	ctxp.getTextOffset = function(text, style) {
    var canvasStyle = getElementStyle(this.canvas),
		    metrics = this.measureText(text), 
        offset = {x: 0, y: 0},
        face = ctx.getFaceFromStyle(style),
				scale = (style.size / face.resolution) * (3/4);

		switch (this.textAlign) {
			default:
      case 'left': break;
			case 'start':  offset.x = (canvasStyle.direction == 'rtl') ? -metrics.width : 0; break;
      case 'center': offset.x = -metrics.width/2; break;
			case 'end':    offset.x = (canvasStyle.direction == 'ltr') ? -metrics.width : 0; break;
      case 'right':  offset.x = -metrics.width; break;
    }
		
		switch (this.textBaseline) {
			case 'hanging': 
      case 'top': offset.y = face.ascender; break;
      case 'middle': offset.y = (face.ascender + face.descender) / 2;
      default:
      case 'alphabetic': break;
      case 'ideographic': break;
      case 'bottom': offset.y = face.descender; break;
    }
		offset.y *= scale;
		return offset;
	}
	
	ctxp.beginText = function(text, x, y, maxWidth, style){
    var metrics = this.measureText(text), 
        offset = this.getTextOffset(text, style);
    
    this.save();
    this.translate(x + offset.x, y + offset.y);
    this.beginPath();
  }
	
	ctxp.fillText = function(text, x, y , maxWidth){
		var style = this.parseStyle(this.font);
		
		this.beginText(text, x, y , maxWidth, style);
		
    if (moz) {
      this.mozTextStyle = this.buildStyle(style);
      this.mozDrawText(text);
    }
		else {
			this.scale(ctx.scaling, ctx.scaling);
			this.renderText(text, style);
		}
		
	  this.closePath();
	  this.fill();
	  this.restore();
	};
	
  ctxp.strokeText = function(text, x, y , maxWidth){
    var style = this.parseStyle(this.font);
    
    this.beginText(text, x, y , maxWidth, style);
		
		if (moz) {
			this.mozTextStyle = this.buildStyle(style);
      this.mozPathText(text);
    }
		else {
			this.scale(ctx.scaling, ctx.scaling);
			this.renderText(text, style);
		}
		
	  this.closePath();
    this.stroke();
    this.restore();
	};
	
	ctxp.measureText = function(text){
		var style = this.parseStyle(this.font), 
		    dim = {width: 0};
				
		if (moz) {
			this.mozTextStyle = this.buildStyle(style);
			dim.width = this.mozMeasureText(text);
		}
		else {
			var face = ctx.getFaceFromStyle(style),
          scale = (style.size / face.resolution) * (3/4);
					
			dim = this.getTextExtents(text, style);
			dim.width *= scale * ctx.scaling;
		}
		
		return dim;
	};
})();
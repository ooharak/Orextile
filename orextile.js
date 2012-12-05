// orextile.js - a poor redmine-like wiki engine on top of JQuery
// (c) 2012 ooharak. All Rights Reserved.

$(function(){
  // parse the whole content
  function parse(text) {
    var lines = text.split(/\n/);
    var i;
    var ctx = {ullevel:0, lines:lines};
    var newlines = new Array(lines.length);
    for (i = 0; i < lines.length; i++) {
       ctx.lineno = i;
       newlines[i] = parseLine(lines[i], ctx);
    }
    return newlines.join("\n");
  }
  
  // parse a line
  function parseLine(line, ctx) {
    line = line.replace(/\r$/, '');
    if (ctx.mode == 'pre') {
      // </pre>
      if (line.match(/^<\/pre>$/)) {
        ctx.mode = undefined;
        return "</pre>\n";
      } else {
        return htmlescape(line);
      }
    }

    // '<!--' .. '-->' : multi-line comment
    if (line == '<!--') {
      ctx.mode = 'comment';
      return line;
    }
    if (ctx.mode == 'comment') {
      if (line == '-->') {
        ctx.mode = undefined;
        return line;
      } else {
        return ' ';
      }
    }

    // '{{//': one-line comment  (A NON-STANDARD EXTENSION)
    if (line.match(/^\{\{\/\//)) {
      return '';
    }

    if  (ctx.macro != undefined) {
      if (line == '}}') {
        var param = ctx.macro;
        ctx.macro = undefined;
        return parseMacro(param.name, param.arg, param.lines, ctx);
      } else if ( line == '</pre>') {
        var param = ctx.macro;
        ctx.macro = undefined;
        var xmax = 0;
        var i;
        for (i = 0; i < param.lines.length; i++) {
          xmax = (xmax < param.lines[i].length ? param.lines[i].length : xmax);
        }
        //  min ( 0.8width, 12pt ) 
        var w = Math.min($(document).width() * 0.8, xmax * 12 / 72.0 * 96);
        var em = w / xmax;
        var h = param.lines.length * 2.0 * em;
        return parseMacro(param.name, [w, h].join(","), param.lines, ctx);
      } else {
        ctx.macro.lines.push(line);
        return '';
      }
    }
    // redmine-like macros 
    var macroary = (/^\{\{([a-zA-Z0-9_]+)(?:\((.*?)\))?(\}\})?/).exec(line);
    if (macroary != null) {
      var name = macroary[1];
      var arg = macroary[2];
      var oneliner = ( macroary[3] == '}}');
      if (oneliner) {
        return parseMacro(name, arg, undefined, ctx);
      } else {
        ctx.macro = {name: name, arg: arg, lines: []};
        return '';
      }
      return '--';
    }
    
    if (line == '<pre class="ascii">') {
        ctx.macro = {name: 'ascii', arg: undefined, lines: []};
        return '';
    }


    // hr
    if (line.match(/^\-{3,}$/)) {
      return '<hr />';
    }

    // table
    if (line.match(/^\|(.*\|)$/)) {
      return parseTable(RegExp.$1, ctx);
    }

    // h1. h2. etc.
    if (line.match(/^(h[0-9])\.\s(.*)$/)) {
      var tag = RegExp.$1;
      var val = RegExp.$2;
      return '<a name="'+val+'"><'+tag+'>'+parseText(val,ctx)+'</'+tag+'></a>';
    }
    // *, **, etc.
    if (line.match(/^(\*+)\s(.*)$/)) {
       var level = RegExp.$1.length;
       var text = RegExp.$2;
       var li = '<li>'+parseText(text,ctx)+'</li>';
       ctx.mode = 'ul';
       if (ctx.ullevel > level) {
         var dif = ctx.ullevel - level;
         ctx.ullevel = level;
         while (dif--) {
           li = '</ul>' + li;
         }
         return li ;
       } else if (ctx.ullevel < level) {
         ctx.ullevel = level;
         return '<ul>'+li;
       } else {
         return li;
       }
    }
    // <pre>
    if (line.match(/^<pre>$/)) {
       ctx.mode = 'pre';
       return "<pre>";
    }

    // paragraph
    if (line.match(/^p\.\s(.*)$/)) {
       ctx.mode = 'p';
       return '<p>' + parseText(RegExp.$1);
    }
    
    // empty lines
    if (line.match(/^$/)) {
       var r = '';
       if (ctx.mode == 'ul') {
          while(ctx.ullevel--) {
            r = r + '</ul>';
          }
       } else if (ctx.mode == 'table') {
         r = '</table>';
       } else if (ctx.mode == 'p') {
         r = '</p>';
       } else {
         r = ' '; 
       }
       ctx.mode = undefined;
       return r;
    }
    // otherwise
    return parseText(line,ctx)+'<br />';
  }
  
  function parseMacro(name,arg,lines,ctx) {
    if (name == "raw") {
      if (lines == undefined) {
        return arg;
      } else {
        if (arg == 'javascript') {
          return '<script type="text/javascript">'+lines.join("\n")+'</script>';
        } else {
          return lines.join("\n");
        }
      }
    }
    if (name == "cadre") {
      return '<div class="cadre">'+parse(lines.join("\n"))+'</div>';
    }
    if (name == "toc") {
      var r = '<ul class="toc">';
      var i;
      var hptn = /^(h[1-9])\.\s(.*)$/;
      var comment = false;
      for (i = 0; i < ctx.lines.length; i++) {
        if (comment) { 
          if (ctx.lines[i] == '-->') {
            comment = false;
          } else {
            //thru
          }
        } else if (ctx.lines[i] == '<!--') {
          comment = true;
        } else {
          var m = hptn.exec(ctx.lines[i]);
          if (m != null) {
            r += '<li class="'+m[1]+'"><a href="#'+m[2]+'">'  + m[2] + '</a></li>';
          }
        }
      }
      r += '</ul>';
      return r;
    }
    if (name == 'ascii') {
        var args=arg.split(/,\s*/);
        var param = {
           width: args[0], 
           height : (args.length == 2 ? args[1] : args[0]),
           id: 'canvas' + ctx.lineno
        };
        return parseAscii(lines, param, ctx);
    }
    return name;
  }

  function parseAscii(lines,param,ctx) {
    var r = '<canvas id="'+param.id+'" width="'+param.width+'" height="'+param.height+'" >';
    r += '<pre class="ascii">';
    r += lines.join("\n");
    r += '</pre>';
    r += '</canvas>';
    r += '<script type="text/javascript">';
    r += '(function(){ ';
    r += '  var canvas = $("#'+param.id+'")[0];'
    r += '  if ( (!canvas) || (!canvas.getContext)) { return; } '
    r += '  var ctx = canvas.getContext("2d"); ';
    r += '  ctx.beginPath(); ';
    
    // calc xmax, dx, dy
    var xmax = 0;
    var i = 0;
    for (i = 0; i < lines.length; i++) {
      xmax = (xmax < lines[i].length) ? lines[i].length : xmax;
    }
    var dx = param.width / xmax;
    var dy = param.height / lines.length;

    function valueorzero(lines, row, col) {
      if (lines == undefined || lines.length <= row) {
        return ' ';
      }
      if (lines[row] == undefined || lines[row].length <= col) {
        return ' ';
      }
      return lines[row][col];
    }

    // for each line
    var row;
    for (row = 0; row < lines.length; row++) {
        var cury = dy * row;
        var cy = dy * (row + 0.5);
        var col;
        for (col = 0; col < lines[row].length; col++) {
           var curx = dx * col;
           var cx = dx * (col + 0.5);
           var c = lines[row][col];
           if (c == '-') {
             r += ' ctx.moveTo('+curx+','+cy+'); ctx.lineTo('+(curx+dx)+','+cy+');ctx.stroke(); ';
           } else if ('<>+'.indexOf(c) >= 0) {
             // left
             if ("-+><".indexOf(valueorzero(lines, row, col-1)) >= 0) {
               r += ' ctx.moveTo('+curx+','+cy+'); ctx.lineTo('+cx+','+cy+');ctx.stroke(); ';
             }
             // right
             if ("-+><".indexOf(valueorzero(lines, row, col+1)) >= 0) {
               r += ' ctx.moveTo('+cx+','+cy+'); ctx.lineTo('+(curx+dx)+','+cy+');ctx.stroke(); ';
             }
             // top
             if ("|+><".indexOf(valueorzero(lines, row-1, col)) >= 0) {
               r += ' ctx.moveTo('+cx+','+cury+'); ctx.lineTo('+cx+','+cy+');ctx.stroke(); ';
             }
             // bottom
             if ("|+><".indexOf(valueorzero(lines, row+1, col)) >= 0) {
               r += ' ctx.moveTo('+cx+','+cy+'); ctx.lineTo('+cx+','+(cury+dy)+');ctx.stroke(); ';
             }
             // right arrow
             if (">" == c) {
               r += ' ctx.moveTo('+(curx)+','+(cury+dy/3)+'); ';
               r += ' ctx.lineTo(' + cx + ',' + cy + '); ';
               r += ' ctx.lineTo('+(curx)+','+(cury+dy*2/3)+'); ';
               r += ' ctx.stroke(); ';
             }
             // left arrow
             if ("<" == c) {
               r += ' ctx.moveTo('+(curx+dx)+','+(cury+dy/3)+'); ';
               r += ' ctx.lineTo(' + cx + ',' + cy + '); ';
               r += ' ctx.lineTo('+(curx+dx)+','+(cury+dy*2/3)+'); ';
               r += ' ctx.stroke(); ';
             }
           } else if (c == '|') {
             r += ' ctx.moveTo('+cx+','+cury+'); ctx.lineTo('+cx+','+(cury+dy)+');ctx.stroke(); ';
           } else if (c == ' ') {
             // skip
           //if char starts here
           } else if ("-|+ ".indexOf(valueorzero(lines, row, col-1)) >= 0) {
             var text = /^([^\|^-^+\s]+)/.exec(lines[row].substring(col))[1];
             r += ' ctx.font = "' + (1.1*dx) + 'px monospace";';
             r += ' ctx.fillText("'+text+'", '+cx+','+(cury+dy)+'); ';
           } else {
             // trailing of chars : ignore
           }
        }
    }
    r += '})();';

    r += '</script>';
    return r;
  }
      
  function parseTable(line,ctx) {
    var r = '';
    if (ctx.mode != 'table') {
      ctx.mode = 'table';
      r += '<table>';
    }
    //var ptn = /(?:(?:([^\|\.\s]+)\.)?([^\|]*)\|)+$/;
    var ary = line.split('|');
    if (ary.length < 2) {
      return line;
    }
    ary.pop();
    var i;
    r += '<tr>';
    for (i = 0; i < ary.length; i++) {
      var optptn = /^(?:(_?)(?:([\/\\])([0-9]+))?\.)?(.*)$/;
      var optm = optptn.exec(ary[i]);
      //console.log(optm);
      var tag = (optm[1] == '_') ? 'th' : 'td';
      var span = optm[3];
      var attr = {undefined:'',
                  '/':'rowspan="'+span+'"',
                  '\\':'colspan="'+span+'"'}[optm[2]];
      var text = optm[4];
      r += '<'+tag+' '+attr+'>'+parseText(text,ctx)+'</'+tag+'>';
    }
    r += '</tr>';
    return r;
  }

  // parse inline elements
  function parseText(text,ctx) {
     if (text == undefined) {
       return '';
     }
     if (text == null) {
       return text;
     }
     // [[ wikiname ]]
     // [[ wikiname | display name ]]:w
     var wikiptn = /\[\[(?:([^\]\|]+)\|)?([^\]]+)\]\]/;
     var wikiary = wikiptn.exec(text);
     if (wikiary != null) {
       var wikiname = wikiary[1];
       var disp = wikiary[2];
       if (wikiname == undefined || wikiname == '') {
         wikiname = disp;
       }
       var link = wikiname + '.html';
       var l = RegExp.leftContext;
       var r = RegExp.rightContext;
       return parseText(l,ctx) + '<a href="'+link+'">'+disp+'</a>' + parseText(r,ctx);
     }

     var urlptn = /\"([^\"]+)\":(\S+)/;
     var urlary = urlptn.exec(text);
     if (urlary != null) {
       var disp = urlary[1];
       var url = urlary[2];
       var l = RegExp.leftContext;
       var r = RegExp.rightContext;
       return parseText(l,ctx) + '<a href="'+url+'">'+disp+'</a>' + parseText(r,ctx);
     }
     

     // image
     var imgptn = /!(>?)([\S]+)!/;
     var imgary = imgptn.exec(text);
     if (imgary != null) {
       var imgcls = ' class="' + (imgary[1] == '>' ? 'right' : 'normal') + '" ';
       var imgname = imgary[2];
       return parseText(imgptn.leftContext,ctx) +
          '<img src="'+imgname+'"' + imgcls + '/>' + parseText(imgptn.rightContext,ctx);
     }

     // *xxx* -> <b>xxx</b>
     if (text.match(/(?:\s|^)\*(?:\(([^\)]*)\))?([^\*]+)\*/)) {
           var l = RegExp.leftContext;
           var r = RegExp.rightContext;
           var clz = RegExp.$1;
           var t = RegExp.$2;
       return parseText(l,ctx)+
          ' <b '+(clz == '' ? '' : ' class="'+clz+'"') +'>'+ htmlescape(t)+ '</b>'+parseText(r,ctx);
     }
     // -xxx- -> <s>xxx</s>
     if (text.match(/(?:\s|^)\-([^\-]+)\-/)) {
           var l = RegExp.leftContext;
           var r = RegExp.rightContext;
           var t = RegExp.$1;
       return parseText(l,ctx)+
          ' <s>'+htmlescape(t)+'</s>'+parseText(r,ctx);
     }

     // otherwise
     return htmlescape(text);
  }

  function htmlescape(t) {
     return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g,"&quot;");
  }

  $('head').append('<meta name="viewport" content="width=device-width" />')
           .append('<meta name="format-detection" content="telephone=no" />')
           ;
  if (document.createStyleSheet) {
     document.createStyleSheet('style.css');
  } else {
     $('head').append('<link rel="stylesheet" href="style.css" type="text/css" charset="utf-8">');
  }

  var text = $('script[type="text/orextile"]').html();
  $('body').html('<div id="header" />' + parse(text) + '<div id="footer" />');
  $.get('header.txt',  function(data,stat,xhr) { $('#header').html(data); }, 'html');
  $.get('footer.txt',  function(data,stat,xhr) { $('#footer').html(data); }, 'html');
  $('.ref').each(function() {
    var $this = $(this);
    var text = $this.text();
    $this.append('<span />');
    $.get('glossary.txt', function(data,stat,xhr){
       $this.children('span').append(findDict(data, text));
    }, 'html');
    $this.click(function() {
      if ($this.data('sw') == 'on') {
        $this.css({'cursor':'help'}).children('span').css({'display': 'none'});
        $this.data('sw', 'off');
      } else {
        $this.css({'cursor':'pointer'}).children('span').css({'display': 'inline', 'cursor':'pointer'});
        $this.data('sw', 'on');
      }
    }).children('span:first').click(function() {
      $this.css({'cursor':'help'}).children('span').css({'display': 'none'});
    });
  });
  
  function findDict(data, key) {
     var ary = data.split(/\r?\n/);
     var i;
     for (i = 0; i < ary.length; i++) {
       if (ary[i].indexOf(key+":") == 0) {
          return ary[i];
       }
     }
     return "";
  }
          
});

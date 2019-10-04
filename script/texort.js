(function(root, factory){

  var inf = {
    namespace: 'Texort'
  };

  // Exposure!!
  ((typeof exports) === "object" && (typeof module) === "object")
    ? (module.exports = factory())
    : (
      (typeof define === "function" && define.amd)
        ? define([], factory)
        : (root[inf.namespace] = factory())
      );

})(this, function(){

  'use strict'

  var _, T, Tp, TR, TRp;

  function Texort(data, config){
    this.__config = {
      ignorecase: true,
      record: default_record_format,
      sorter: sort_score,
      scr_mag_text_match: 10,
      scr_mag_fragment_match: 10,
      scr_mag_char_match: 1,
      scr_mag_min_complmatch: 2,
      score_ignore_threthhold: 0,
      use_forward_match_score: true
    };
    this.result = [];
    this.collection = {
      record: [],
      original: [],
      result: []
    };

    this.init(data, config);
  }

  function TexortProto(){};

  function TexortRecord(o, opt){
    var gtd = (opt && typeof opt.generator == 'function') ? opt.generator(o) : o;
    var self = this;
    self.index = 0;
    self.original = o;
    self.text = '';
    self.meta = [];
    self.force = 0;
    self.scored = [];
    for(var k in gtd){
      self.assign(k, gtd[k]);
    }
  };
  
  function Helper(){}
  
  T = Texort;
  TR = TexortRecord;
  Tp = T.prototype = new TexortProto;
  TRp = TR.prototype = new TexortProto;
  _ = new Helper;
  
  _.assign = function(o, k, v){
    if(
      o.hasOwnProperty(k)
      &&
      typeof o[k] == typeof v
    ){
      o[k] = v;
      return true;
    }
    return false;
  }
  
  _.override = function(o, s){
    for(var k in s){
      _.assign(o, k, s[k]);
    }
    return o;
  }

  _.array_concat_unique = function(d){
    (Array.prototype.slice.call(arguments).slice(1))
    .map(function(s){
      s.reduce(function(m, e){
        return ((m.indexOf(e) == -1) && m.push(e)) ?m:m;
      }, d);
    });
    return d;
  }

  TRp.assign = function(key, val){
    return _.assign(this, key, val);
  }

  Tp.constructor = T;

  Tp.init
  = function(data, config){
      this.config(config || {});
      this.append(data || []);
    }

  Tp.config
  = function(config, value){
      if(typeof config == "object"){
        _.override(this.__config, config);
        return this;
      }else if(typeof config == "string"){
        if(this.__config.hasOwnProperty(config)){
          switch(arguments.length){
            case 1:
              return this.__config[config];
            break;
            case 2:
              _.assign(this.__config, k, config[k]);
            break;
          }
        }
      }else if(arguments.length == 0){
        return this.__config;
      }
      return null;
    }

  Tp.append
  = function(c){
      if(c && c instanceof Array){
        this.collection.original
        = _.array_concat_unique(
          this.collection.original,
          c
        );
        this.collection.record
        = this.collection.original
          .map(record_generator(
            this.__config.record
          ));
      }
      return this;
    }

  Tp.sort
  = function(term, opt){
      this.result
      = sort_collection(
          this.collection,
          term,
          Object.assign({}, this.__config, opt)
        ).result;
      return this;
    }

  function default_record_format(r){
    return {
      'text': r,
      'meta': r.split(/( ,\.:;\?\!\/"'\(\)&)/g)
    };
  }

  function record_generator(g){
    return function(o, i){
      var gtd = new TexortRecord(o, {
        generator: g
      });
      gtd.assign('index', i);
      return gtd;
    }
  }

  function sort_collection(collection, term, opt){
    var opt = opt || {};
    var term = term.trim();
    var scored = [];

    collection.result
    = (collection.record.length > 1)
    ? collection.record.sort(function(a,b){
        [a,b].map(function(o, i){
          if(scored.indexOf(o) > -1){
            return;
          }
          var score = 0;
          if(o.hasOwnProperty('force') && o.force){
            score = o.force;
          }else{
            if(term.length){
              score = score_one(o, term, opt);
            }
          }
          o.score = score;
          scored.push(o);
        });
        return opt.sorter(a, b, opt);
      })
    : collection.record.map(function(o){
        var score = 0;
        if(o.hasOwnProperty('force') && o.force){
          score = o.force;
        }else{
          if(term.length){
            score = score_one(o, term, opt);
          }
        }
        o.score = score;
        return o;
      });
    return collection;
  }

  function sort_score(a, b, config){
    if(a.force){
      return a.force;
    }
    var diff = b.score - a.score;
    if(diff != 0){
      return diff;
    }else{
      /* alpha ASC */
      var ta = (config.ignorecase)
        ? a.text.toLowerCase()
        : a.text;
      var tb = (config.ignorecase)
        ? b.text.toLowerCase()
        : b.text;
      return (ta > tb) ? 1 : -1;
    }
  }

  function score_one(obj, term, config){
    var
    score = 0
    ;
    
    obj.score = 0;
    obj.scored = [];
    
    if(config.use_forward_match_score){
      score += score_string(
        obj.text, term, config.scr_mag_text_match,
        config
      );
    }
    
    score += score_one_frag(obj, term, config);

    if(score < config.score_ignore_threthhold){
      score = 0;
    }

    return score;
  }
  
  function score_one_frag(obj, term, config){
    var
    score = 0,
    frag = [],
    term_frg = []
    ;
    frag = _.array_concat_unique(
      [],
      (config.ignorecase
       ? obj.text.toLowerCase()
       : obj.text).split(" "),
      (config.ignorecase
       ? obj.meta.map(function(e){
           return e.toLowerCase();
         })
       : obj.meta)
    );
    term_frg =  _.array_concat_unique(
      [],
      (config.ignorecase
       ? term.toLowerCase()
       : term).split(" ")
    ).filter(function(s){
      return s.length > 0;
    });

    var mag = config.scr_mag_fragment_match;
    var t_i = (
      term_frg.length > 1
      ? term_frg.length - 1
      : 1
    );
    var magd = 0;
    var cur_scr = 0;
    var pre_scr = 0;
    term_frg.map(function(tf, i){
      cur_scr = 0;
      tf = tf.trim();
      if(tf.length == 0){
        return;
      }
      // latter match means less score.
      magd = (
        (!config.use_forward_match_score || !i)
        ? 0
        : (mag*.5) * (i/t_i)
      );
      
      cur_scr
      += push_scored(obj, obj.text+"+"+tf)
      ? score_string(
          obj.text, tf,
          mag - magd,
          config
        )
      : 0;
      
      frag.map(function(f){
        var p = push_scored(obj, f+"+"+tf);
        cur_scr
        += p
        ? score_string(f, tf, (mag - magd)/2, config)
        : 0;
      });

      score += cur_scr * (
        (pre_scr && cur_scr) ? 1.2 : 1
      );
      
      pre_scr = cur_scr;
    });

    var fragc = frag.join("").replace(" ", "");
    var t = (config.ignorecase
      ? term.toLowerCase()
      : term);

    score += (
      (config.ignorecase
        ? fragc.toLowerCase()
        : fragc)
      .split("")
      .filter(function(c){
        var r
        = push_scored(obj, c+"+"+c)
          &&
          (t.indexOf(c) >= 0);
        return r;
      }).length
    ) * config.scr_mag_char_match;

    return score;
  }
  
  function push_scored(o, t){
    if(o.scored.indexOf(t) < 0){
      o.scored.push(t);
      return true;
    }
    return false;
  }

  function score_string(hay, ndl, ratio, config){
    var score = 0;
    var text = hay;
    var term = ndl;
    var lc = term.toLowerCase();
    var tc = text.toLowerCase();
    var lmg = 0;

    if(ratio < 1){
      return 0;
    }

    if(config.ignorecase){
      text = tc;
      term = lc;
    }

    score
    += (
      ((term.length < config.scr_mag_min_complmatch)
        ? (count_forward_match(term, text)
            ? config.scr_mag_min_complmatch
            : 0
          )
        : (count_forward_match(term, text)
          * (term == text ? term.length : term.length/2))
      ) * ratio
    );
    
    score
    += (
      (text.indexOf(term) > -1)
      ? (term.length / 2)
      : 0
    );

    // Additionally, checking ignorecase.
    (!config.ignorecase && ratio != 1)
    && (
      score
      += (score_string(
        tc,lc,
        1, config
      ) * ratio * .8)
    );

    return score * ratio;
  }

  function count_forward_match(text, term){
    var score = 0;
    var chrs = term.split("");
    for(var i = 0; i < chrs.length; i++){
      var chr = chrs[i];
      if(text.indexOf(chr) == i){
        score += 1;
      }else{
        break;
      }
    }
    return score;
  }

  return T;
});

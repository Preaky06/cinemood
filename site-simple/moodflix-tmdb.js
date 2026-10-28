/* MoodFlix — couche TMDB.
   Aucune base locale : tout vient du catalogue TMDB (900 000+ films).
   Chaque réponse du parcours se traduit en paramètres de requête explicites,
   puis les candidats sont re-classés par un score déterministe (mêmes réponses = même résultat). */
window.MoodflixTMDB = (function () {
  'use strict';

  /* AUCUNE CLÉ DANS CETTE PAGE.
     Les appels passent par /tmdb, une fonction Cloudflare Pages qui ajoute la clé
     côté serveur (variable d'environnement TMDB_KEY). Voir cloudflare-pages/functions/.
     Repli : si le proxy n'existe pas (ouverture du fichier en local), on utilise une clé
     saisie par le développeur et gardée dans son propre navigateur — jamais dans le code. */
  var PROXY = '/tmdb';
  var DIRECT = 'https://api.themoviedb.org/3';
  var IMG = 'https://image.tmdb.org/t/p/';
  var cache = {};
  var mode = 'proxy';
  /* Clé de repli, utilisée UNIQUEMENT si le proxy ne répond pas.
     Dès que la variable TMDB_KEY existe côté Cloudflare, le proxy répond et cette clé
     n'est jamais employée. Elle est lisible dans la page : à considérer comme publique,
     et à régénérer sur TMDB si le quota est abusé.

     On ne lit PLUS localStorage : une clé périmée qui y traînait rendait le site vide
     sans aucun moyen de s'en sortir pour le visiteur. On purge au passage les restes. */
  var FALLBACK_KEY = '06bec21ad34bd80361607be39202db1f';
  var KEY = FALLBACK_KEY;
  try { localStorage.removeItem('moodflix.tmdb.key'); } catch (e) {}

  function qs(params, withKey) {
    var p = Object.assign({language: (window.MoodflixI18n && window.MoodflixI18n.lang === 'en') ? 'en-US' : 'fr-FR', region: 'FR', include_adult: 'false'}, params || {});
    if (withKey) p.api_key = KEY;
    return Object.keys(p).filter(function (k) { return p[k] !== undefined && p[k] !== null && p[k] !== ''; })
      .map(function (k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
  }
  /* Jeton de parcours délivré par /api/run. Il prouve au proxy que la requête
     appartient à un parcours régulièrement décompté du quota. Sans lui, les
     requêtes du moteur sont bridées : on ne peut plus « farmer » les
     recommandations en contournant le compteur. */
  var runToken = '';
  function setRunToken(t) { runToken = t || ''; }

  function once(base, path, params, withKey) {
    var opts = {};
    if (base === PROXY && runToken) opts.headers = {'X-CM-Run': runToken};
    return fetch(base + path + '?' + qs(params, withKey), opts).then(function (r) {
      if (!r.ok) throw new Error('TMDB ' + r.status);
      return r.json();
    });
  }
  function direct(path, params) {
    return once(DIRECT, path, params, true).catch(function (e) {
      /* clé refusée : on rétablit la clé embarquée et on réessaie une fois */
      if (/40[13]/.test(e.message) && KEY !== FALLBACK_KEY) {
        KEY = FALLBACK_KEY;
        cache = {};
        return once(DIRECT, path, params, true);
      }
      throw e;
    });
  }
  function request(path, params) {
    if (mode === 'proxy') {
      return once(PROXY, path, params, false).catch(function (e) {
        /* 429 : le proxy fonctionne et nous bride volontairement. On ne contourne pas. */
        if (/429/.test(e.message)) throw new Error('Trop de requêtes. Patiente un instant.');
        mode = 'direct';
        return direct(path, params);
      });
    }
    return direct(path, params);
  }
  function api(path, params) {
    var ck = path + '?' + qs(params, false);
    if (cache[ck]) return cache[ck];
    cache[ck] = request(path, params).catch(function (e) { delete cache[ck]; throw e; });
    return cache[ck];
  }

  /* clé de secours pour le développement local uniquement : elle reste dans CE navigateur */
  /* Développement uniquement : la clé reste en mémoire, jamais persistée —
     une valeur périmée ne peut plus condamner un visiteur au silence. */
  function setKey(k) {
    KEY = (k || '').trim() || FALLBACK_KEY;
    cache = {}; mode = 'proxy';
  }
  /* exposé plus bas via l'objet retourné */
  function key() { return KEY ? '••••••••' : ''; }
  function poster(p, size) { return p ? IMG + (size || 'w500') + p : null; }

  /* ---------- genres TMDB ---------- */
  var G = {action:28, aventure:12, animation:16, comedie:35, crime:80, doc:99, drame:18, famille:10751,
    fantastique:14, histoire:36, horreur:27, musique:10402, mystere:9648, romance:10749, sf:878,
    thriller:53, guerre:10752, western:37};
  var GENRE_FR = {28:'Action',12:'Aventure',16:'Animation',35:'Comédie',80:'Policier',99:'Documentaire',
    18:'Drame',10751:'Famille',14:'Fantastique',36:'Histoire',27:'Horreur',10402:'Musique',9648:'Mystère',
    10749:'Romance',878:'Science-fiction',53:'Thriller',10752:'Guerre',37:'Western',10770:'Téléfilm'};

  /* ---------- parcours : 10 questions, la 2ᵉ dépend de la 1ʳᵉ ---------- */
  var MOODS = {id:'mood', options:[
    {v:'detente', l:'Crevé', sub:'je veux juste me poser', genres:[G.comedie, G.famille, G.aventure]},
    {v:'rire', l:'J\u2019ai besoin de rire', sub:'la journée a été longue', genres:[G.comedie]},
    {v:'emotion', l:'Sensible', sub:'envie d\u2019être touché', genres:[G.drame, G.romance]},
    {v:'adrenaline', l:'Plein d\u2019énergie', sub:'il faut que ça bouge', genres:[G.action, G.thriller]},
    {v:'peur', l:'D\u2019humeur à frissonner', sub:'le cœur qui bat', genres:[G.horreur, G.thriller]},
    {v:'evasion', l:'Besoin de changer d\u2019air', sub:'partir loin d\u2019ici', genres:[G.sf, G.fantastique, G.aventure]},
    {v:'reflechir', l:'L\u2019esprit curieux', sub:'envie de cogiter', genres:[G.drame, G.mystere]},
    {v:'surprise', l:'Un peu blasé', sub:'étonne-moi', genres:[G.mystere, G.thriller]}
  ]};

  /* ---------- 1re question : un ressenti simple ----------
     Chaque ressenti ouvre sa propre 2e question. Chaque réponse de cette 2e
     question pointe vers un chemin précis du moteur (humeur + sous-choix),
     puis la 3e question affine ce chemin. Tout se suit. */
  var FEEL_MAP = {
    heureux:    {l:'Heureux', sub:'la journée a été bonne', titre:'Tu veux prolonger ça comment ?', opts:[
      ['rire', 'absurde', 'Avec un vrai fou rire', 'n\u2019importe quoi, et c\u2019est bien'],
      ['rire', 'tendre', 'Avec une comédie qui réchauffe', 'tendre et sans méchanceté'],
      ['detente', 'feelgood', 'Avec un film qui fait du bien', 'on en ressort encore mieux'],
      ['evasion', 'aventure', 'En partant à l\u2019aventure', 'grands espaces, expéditions']]},
    amoureux:   {l:'Amoureux', sub:'le cœur qui bat', titre:'Quelle histoire d\u2019amour te tente ?', opts:[
      ['emotion', 'amour', 'Une grande histoire d\u2019amour', 'regards et silences'],
      ['rire', 'romantique', 'Une comédie romantique', 'ça finit bien',
        [['romantique0'], ['romantique3'], ['romantique2']]],
      ['emotion', 'melo', 'Un amour qui fait pleurer', 'prévois les mouchoirs',
        [['melo1', 'Un amour impossible', 'ça ne peut pas marcher'], ['amour0', 'Un amour qui finit mal', 'deux êtres, puis plus rien'],
         ['amour2', 'Un amour d\u2019un autre temps', 'costumes et lettres']], 'Quel amour va te briser le cœur ?']]},
    triste:     {l:'Triste', sub:'un coup de mou', titre:'Qu\u2019est-ce qui te ferait du bien ?', opts:[
      ['detente', 'doudou', 'Être réconforté', 'un film comme un plaid'],
      ['detente', 'feelgood', 'Qu\u2019on me remonte le moral', 'on repart avec le sourire'],
      ['emotion', 'melo', 'Pleurer un bon coup', 'ça libère'],
      ['emotion', 'famille', 'Me sentir entouré', 'des liens qui tiennent bon']]},
    fatigue:    {l:'Fatigué', sub:'je veux juste me poser', titre:'Tu veux te reposer comment ?', opts:[
      ['detente', 'popcorn', 'Un grand spectacle', 'cerveau en pause'],
      ['detente', 'legere', 'Une petite aventure', 'sans prise de tête'],
      ['rire', 'tendre', 'Rire sans effort', 'une comédie douce'],
      ['evasion', 'anim', 'Un dessin animé', 'pour tous les âges']]},
    enerve:     {l:'Énervé', sub:'il faut que ça sorte', titre:'Tu veux évacuer ça comment ?', opts:[
      ['adrenaline', 'action', 'Que ça explose', 'bagarres et cascades'],
      ['adrenaline', 'poursuite', 'Une course sans répit', 'ça ne s\u2019arrête jamais'],
      ['adrenaline', 'guerre', 'Une grande bataille', 'la guerre en grand'],
      ['rire', 'grincant', 'En riant de tout', 'un humour noir, qui pique']]},
    temeraire:  {l:'Téméraire', sub:'prêt à frissonner', titre:'Qu\u2019est-ce qui te fait le plus peur ?', opts:[
      ['peur', 'horreur', 'Sursauter', 'de la vraie horreur'],
      ['peur', 'surnaturel', 'Ce qu\u2019on ne peut pas expliquer', 'fantômes, démons, malédictions'],
      ['peur', 'psy', 'Qu\u2019on joue avec mes nerfs', 'une tension qui monte'],
      ['peur', 'survie', 'Être traqué, piégé', 'survivre coûte que coûte']]},
    blase:      {l:'Blasé', sub:'rien ne m\u2019étonne', titre:'Qu\u2019est-ce qui pourrait te réveiller ?', opts:[
      ['surprise', 'twist', 'Une fin que je n\u2019ai pas vue venir', 'tout bascule'],
      ['adrenaline', 'braquage', 'Un casse bien ficelé', 'un plan, une équipe'],
      ['surprise', 'etrange', 'Quelque chose de vraiment bizarre', 'hors de toute norme'],
      ['surprise', 'melange', 'Un film qui change de ton', 'on rit, puis plus du tout']]},
    curieux:    {l:'Curieux', sub:'envie d\u2019apprendre', titre:'Tu es curieux de quoi ?', opts:[
      ['surprise', 'vrai', 'D\u2019une histoire vraie incroyable', 'et pourtant, c\u2019est arrivé'],
      ['reflechir', 'histoire', 'De l\u2019Histoire', 'ce qui s\u2019est vraiment passé'],
      ['reflechir', 'societe', 'Du monde qui m\u2019entoure', 'la société, la justice'],
      ['reflechir', 'esprit', 'De ce qui se passe dans une tête', 'mémoire, folie, identité']]},
    reveur:     {l:'Rêveur', sub:'la tête ailleurs', titre:'Tu as envie de partir où ?', opts:[
      ['evasion', 'fantastique', 'Dans un monde magique', 'là où tout est possible'],
      ['evasion', 'sf', 'Dans l\u2019espace', 'un autre monde'],
      ['reflechir', 'futur', 'Dans le futur', 'ce qui pourrait arriver'],
      ['evasion', 'anim', 'Dans un dessin animé', 'l\u2019animation, pour tous']]}
  };
  var Q1 = {id:'feel', kicker:'Ton humeur', titre:'Comment tu te sens ce soir ?', options:
    Object.keys(FEEL_MAP).map(function (k) { return {v: k, l: FEEL_MAP[k].l, sub: FEEL_MAP[k].sub}; })};
  var FEEL_BRANCH = {};

  var BRANCH = {
    rire: {id:'sub', kicker:'Ton rire', titre:'Quel rire te ferait du bien ?', options:[
      {v:'tendre', l:'Un rire qui réchauffe', sub:'tendre et sans méchanceté', genres:[G.comedie, G.famille]},
      {v:'absurde', l:'Un vrai fou rire', sub:'n\u2019importe quoi, et c\u2019est bien', genres:[G.comedie, G.fantastique]},
      {v:'romantique', l:'Un rire amoureux', sub:'une histoire qui finit bien', genres:[G.comedie, G.romance]},
      {v:'grincant', l:'Un rire qui pique', sub:'un peu méchant, un peu noir', genres:[G.comedie, G.crime]}]},
    peur: {id:'sub', kicker:'Tes frissons', titre:'Qu\u2019est-ce qui te fait le plus frissonner ?', options:[
      {v:'psy', l:'Qu\u2019on joue avec mes nerfs', sub:'une tension qui monte lentement', genres:[G.thriller, G.mystere]},
      {v:'horreur', l:'Sursauter', sub:'de la vraie horreur', genres:[G.horreur]},
      {v:'surnaturel', l:'Ce qu\u2019on ne peut pas expliquer', sub:'fantômes, démons, malédictions', genres:[G.horreur, G.fantastique]},
      {v:'survie', l:'Être traqué, piégé', sub:'survivre coûte que coûte', genres:[G.thriller, G.action]}]},
    reflechir: {id:'sub', kicker:'Ta curiosité', titre:'Tu as envie de cogiter sur quoi ?', options:[
      {v:'societe', l:'Le monde qui m\u2019entoure', sub:'la société, la justice', genres:[G.drame]},
      {v:'esprit', l:'Ce qui se passe dans une tête', sub:'mémoire, folie, identité', genres:[G.mystere, G.drame]},
      {v:'histoire', l:'Ce qui s\u2019est vraiment passé', sub:'l\u2019Histoire, la vraie', genres:[G.histoire, G.drame]},
      {v:'futur', l:'Ce qui pourrait arriver', sub:'le futur, la science', genres:[G.sf, G.drame]}]},
    emotion: {id:'sub', kicker:'Ton cœur', titre:'Qu\u2019est-ce qui te touche le plus ?', options:[
      {v:'melo', l:'Une histoire qui serre le cœur', sub:'prévois les mouchoirs', genres:[G.drame]},
      {v:'amour', l:'Une belle histoire d\u2019amour', sub:'regards et silences', genres:[G.romance, G.drame]},
      {v:'famille', l:'Les liens d\u2019une famille', sub:'parents, enfants, fratrie', genres:[G.famille, G.drame]},
      {v:'musique', l:'Une histoire portée par la musique', sub:'ça chante, ça danse', genres:[G.musique, G.drame]}]},
    adrenaline: {id:'sub', kicker:'Ton énergie', titre:'Tu veux la dépenser comment ?', options:[
      {v:'action', l:'Bagarres et explosions', sub:'de l\u2019action pure', genres:[G.action]},
      {v:'poursuite', l:'Une course sans répit', sub:'ça ne s\u2019arrête jamais', genres:[G.action, G.thriller]},
      {v:'braquage', l:'Un casse bien ficelé', sub:'un plan, une équipe', genres:[G.crime, G.thriller]},
      {v:'guerre', l:'Au cœur d\u2019une bataille', sub:'la guerre en grand', genres:[G.guerre, G.action]}]},
    surprise: {id:'sub', kicker:'Ta surprise', titre:'Qu\u2019est-ce qui pourrait te réveiller ?', options:[
      {v:'twist', l:'Une fin que je n\u2019ai pas vue venir', sub:'tout bascule', genres:[G.mystere, G.thriller]},
      {v:'etrange', l:'Quelque chose de vraiment bizarre', sub:'hors de toute norme', genres:[G.fantastique, G.sf]},
      {v:'vrai', l:'Une histoire vraie incroyable', sub:'et pourtant, c\u2019est arrivé', genres:[G.histoire, G.crime]},
      {v:'melange', l:'Un film qui change de ton', sub:'on rit, puis plus du tout', genres:[G.drame, G.comedie]}]},
    detente: {id:'sub', kicker:'Ton repos', titre:'Qu\u2019est-ce qui te repose le mieux ?', options:[
      {v:'feelgood', l:'Un film qui fait du bien', sub:'on en ressort content', genres:[G.comedie, G.famille]},
      {v:'doudou', l:'Un film réconfortant', sub:'comme un plaid', genres:[G.famille, G.animation]},
      {v:'legere', l:'Une petite aventure', sub:'sans prise de tête', genres:[G.aventure, G.comedie]},
      {v:'popcorn', l:'Un grand spectacle', sub:'cerveau en pause', genres:[G.action, G.aventure]}]},
    evasion: {id:'sub', kicker:'Ton évasion', titre:'Tu as envie de partir où ?', options:[
      {v:'sf', l:'Dans l\u2019espace ou le futur', sub:'un autre monde', genres:[G.sf]},
      {v:'fantastique', l:'Dans un monde magique', sub:'là où tout est possible', genres:[G.fantastique, G.aventure]},
      {v:'aventure', l:'Au bout du monde', sub:'grands espaces, expéditions', genres:[G.aventure]},
      {v:'anim', l:'Dans un dessin animé', sub:'l\u2019animation, pour tous', genres:[G.animation, G.aventure]}]}
  };


  Object.keys(FEEL_MAP).forEach(function (k) {
    var fm = FEEL_MAP[k];
    FEEL_BRANCH[k] = {id: 'sub', kicker: fm.l, titre: fm.titre, options: fm.opts.map(function (o) {
      var base = (BRANCH[o[0]].options.filter(function (x) { return x.v === o[1]; })[0]) || {};
      var out = {v: o[1], l: o[2], sub: o[3], mood: o[0], genres: (base.genres || []).slice()};
      if (o[4]) out.micro = o[4];
      if (o[5]) out.mtitre = o[5];
      return out;
    })};
  });

  /* 3ᵉ niveau : la question dépend du sous-choix — pair = deux genres croisés (ET) */
  var MICRO = {
    tendre:['Une comédie qui fait du bien, mais laquelle ?',[['Feel-good familial','on ressort léger',[35,10751]],['Comédie douce-amère','ça rit et ça pique',[35,18]],['Comédie romantique','avec des sentiments',[35,10749]],['Juste drôle','rien de plus',[35]]]],
    absurde:['Jusqu\u2019où part l\u2019absurde ?',[['Délire de science-fiction','les règles sautent',[35,878]],['Fantaisie décalée','un monde à part',[35,14]],['Comédie d\u2019action','ça explose en riant',[35,28]],['Humour pur','sans décor',[35]]]],
    romantique:['Quelle romance ?',[['Comédie romantique','ça finit bien',[35,10749]],['Romance qui serre le cœur','ça fait mal',[10749,18]],['Romance d\u2019un autre temps','costumes et lettres',[10749,36]],['Romance légère','sans complication',[10749]]]],
    grincant:['Grinçant comment ?',[['Satire sociale','ça vise juste',[35,18]],['Comédie noire criminelle','on rit jaune',[35,80]],['Humour et guerre','absurde total',[35,10752]],['Cynisme pur','sans filtre',[35]]]],
    psy:['La tension vient d\u2019où ?',[['Un mystère à résoudre','on cherche avec',[53,9648]],['Un tueur dans l\u2019ombre','on le sent venir',[53,27]],['Un drame sous pression','ça monte lentement',[53,18]],['La tension pure','rien d\u2019autre',[53]]]],
    horreur:['Quelle horreur ?',[['Qui joue avec les nerfs','ça guette',[27,53]],['Surnaturelle','ça vient d\u2019ailleurs',[27,14]],['De science-fiction','la menace est autre',[27,878]],['Horreur frontale','sans détour',[27]]]],
    surnaturel:['D\u2019où vient l\u2019étrange ?',[['Fantômes et lieux hantés','ça hante',[27,14]],['Mystère inexpliqué','on ne saura pas tout',[27,9648]],['Créatures venues d\u2019ailleurs','contact hostile',[27,878]],['Fantastique sombre','le merveilleux qui tourne mal',[27,14]]]],
    survie:['Survivre à quoi ?',[['Une traque','on est la proie',[27,53]],['Enfermé, piégé','pas d\u2019issue',[27,53]],['Un monde effondré','après la fin',[27,878]],['Une nature hostile','seul dehors',[27,12]]]],
    societe:['Quel angle ?',[['Le crime et la justice','ce qu\u2019on juge',[18,80]],['Une époque, un pays','le contexte parle',[18,36]],['La guerre et ses traces','ce qui reste',[18,10752]],['Le quotidien','à hauteur d\u2019homme',[18]]]],
    esprit:['Explorer quoi ?',[['Une énigme mentale','ça se démonte',[9648,53]],['Une conscience qui vacille','qui suis-je',[878,18]],['Un secret enfoui','ça remonte',[9648,18]],['L\u2019intime','sans artifice',[18]]]],
    histoire:['Quelle Histoire ?',[['Un conflit majeur','la grande échelle',[36,10752]],['Une vie hors norme','un destin',[36,18]],['Un crime réel','ça a existé',[36,80]],['Une grande fresque','le souffle',[36]]]],
    futur:['Quel futur ?',[['Un futur qui fait peur','ça dérape',[878,53]],['Un futur intime','à hauteur d\u2019humain',[878,18]],['Un futur en action','ça se bat',[878,28]],['Une idée vertigineuse','le concept d\u2019abord',[878]]]],
    melo:['Ça remue comment ?',[['Une famille qui se déchire','les liens cassent',[18,10751]],['Un amour impossible','ça ne peut pas marcher',[18,10749]],['Une histoire vraie','c\u2019est arrivé',[18,36]],['Un drame pur','frontal',[18]]]],
    amour:['Quelle histoire d\u2019amour ?',[['Deux êtres, rien d\u2019autre','en huis clos',[10749,18]],['Amour et légèreté','ça respire',[10749,35]],['Amour d\u2019époque','autre siècle',[10749,36]],['Amour et destin','plus grand qu\u2019eux',[10749,14]]]],
    famille:['Quels liens ?',[['Parents et enfants','la transmission',[18,10751]],['À hauteur d\u2019enfant','son regard',[10751,16]],['Une fratrie','frères et sœurs',[18,35]],['Une famille en crise','ça craque',[18]]]],
    musique:['La musique comment ?',[['Un biopic musical','une vraie vie',[10402,36]],['Une comédie musicale','ça chante',[10402,35]],['Un drame musical','ça coûte cher',[10402,18]],['La musique au centre','elle porte tout',[10402]]]],
    action:['L\u2019action, ça donne quoi ?',[['Grand spectacle','le maximum',[28,12]],['Action tendue','on serre les dents',[28,53]],['Action et humour','ça respire',[28,35]],['Action pure','sans détour',[28]]]],
    poursuite:['On poursuit quoi ?',[['Un criminel','la traque',[28,80]],['Un espion','le double jeu',[28,53]],['Une course contre la montre','le chrono',[28,12]],['Ça ne s\u2019arrête jamais','plein régime',[28]]]],
    braquage:['Quel casse ?',[['Un plan millimétré','tout est prévu',[80,53]],['Un casse qui dérape','rien ne va',[80,18]],['Un casse à l\u2019humour','l\u2019équipe fait le sel',[80,35]],['Un casse culte','les grands classiques',[80]]]],
    guerre:['Quelle guerre ?',[['Au front','dans la boue',[10752,28]],['Dans l\u2019Histoire','le contexte compte',[10752,36]],['Le drame des civils','de l\u2019autre côté',[10752,18]],['Le champ de bataille','l\u2019échelle',[10752]]]],
    sf:['Quel ailleurs ?',[['L\u2019espace','vraiment loin',[878,12]],['Un futur sombre','ça a mal tourné',[878,53]],['Une idée vertigineuse','ça retourne la tête',[878,9648]],['La SF pure','le genre pour lui-même',[878]]]],
    fantastique:['Quelle magie ?',[['Une grande quête','le long chemin',[14,12]],['Un conte','pour tous',[14,10751]],['Une magie sombre','ça inquiète',[14,53]],['Le merveilleux','sans limite',[14]]]],
    aventure:['Partir où ?',[['Une expédition','l\u2019inconnu',[12,28]],['Un voyage initiatique','on revient changé',[12,18]],['Un monde inconnu','hors carte',[12,878]],['L\u2019aventure pure','le mouvement',[12]]]],
    twist:['Le retournement porte sur quoi ?',[['Une enquête','on cherche le coupable',[9648,80]],['Une identité','qui est qui',[9648,53]],['La réalité elle-même','le sol se dérobe',[9648,878]],['Un secret de famille','ça sort',[9648,18]]]],
    etrange:['Étrange à quel point ?',[['Doucement décalé','un pas de côté',[14,18]],['Franchement bizarre','ça déraille',[878,14]],['Inquiétant','ça met mal à l\u2019aise',[14,53]],['Onirique','comme un rêve',[14,12]]]],
    vrai:['Quelle histoire vraie ?',[['Un fait divers','ça a fait la une',[36,80]],['Un destin hors norme','une vie entière',[36,18]],['Un exploit','sport, survie, sauvetage',[36,18]],['Un moment d\u2019Histoire','ça a compté',[36,10752]]]],
    melange:['Inclassable comment ?',[['Ça rit puis ça serre','virage à mi-film',[35,18]],['Drame avec du fantastique','le réel dérape',[18,14]],['Comédie qui devient thriller','ça tourne mal',[35,53]],['Un objet à part','sans étiquette',[18]]]],
    feelgood:['Du bien, mais comment ?',[['Une comédie chaleureuse','ça réchauffe',[35,10751]],['Une rencontre','deux personnes',[35,10749]],['Un sursaut','ça relève',[18,35]],['Rien que du rire','sans arrière-plan',[35]]]],
    doudou:['Ton doudou, c\u2019est plutôt…',[['Un classique animé','valeur sûre',[16,10751]],['Une aventure familiale','tout public',[10751,12]],['Un conte réconfortant','ça berce',[14,10751]],['Une comédie familiale','ça rit ensemble',[35,10751]]]],
    legere:['Une aventure comment ?',[['Sur la route','ça bouge',[12,35]],['Une virée mouvementée','ça bouge',[12,28]],['Vers l\u2019inconnu','sans danger réel',[12,10751]],['Grand air','ça respire',[12,18]]]],
    popcorn:['Le divertissement pur, c\u2019est…',[['Du blockbuster','le maximum',[28,878]],['De l\u2019aventure spectaculaire','le grand jeu',[28,12]],['De l\u2019action drôle','ça ne se prend pas au sérieux',[28,35]],['Un braquage réjouissant','l\u2019équipe et le plan',[35,80]]]],
    anim:['Quelle animation ?',[['Pour toute la famille','personne ne s\u2019ennuie',[16,10751]],['Une aventure animée','ça bouge',[16,12]],['Animation qui touche','ça serre',[16,18]],['Animation qui fait rire','ça pétille',[16,35]]]]
  };
  Object.keys(MICRO).forEach(function (k) {
    var m = MICRO[k];
    MICRO[k] = {id: 'micro', kicker: 'Plus précisément', titre: m[0], options: m[1].map(function (o, i) {
      return {v: k + i, l: o[0], sub: o[1], pair: o[2]};
    })};
  });

  var MICRO_BY_V = {};
  Object.keys(MICRO).forEach(function (k) { MICRO[k].options.forEach(function (o) { MICRO_BY_V[o.v] = o; }); });

  var REST = [
    {id:'intensite', kicker:'Ton seuil', titre:'Tu te sens prêt à être secoué comment ?', options:[
      {v:'doux', l:'Pas du tout', sub:'je veux rester tranquille', intensity:1, without:[G.horreur, G.guerre]},
      {v:'equilibre', l:'Un peu', sub:'de la tension, sans excès', intensity:2},
      {v:'fort', l:'Beaucoup', sub:'je veux que ça cogne', intensity:3},
      {v:'extreme', l:'À fond', sub:'rien ne me fait peur', intensity:4}]},
    {id:'social', kicker:'Ton public', titre:'Tu regardes avec qui ?', options:[
      {v:'seul', l:'Seul', sub:'personne à ménager', social:'seul'},
      {v:'couple', l:'À deux', sub:'même écran, même envie', social:'couple'},
      {v:'amis', l:'Entre amis', sub:'ça commente', social:'amis'},
      {v:'famille', l:'En famille', sub:'tous les âges', social:'famille', without:[G.horreur], certif:true},
      {v:'enfants', l:'Avec des enfants', sub:'rien de dur', social:'enfants', without:[G.horreur, G.guerre, G.crime], certif:true},
      {v:'novice', l:'Avec quelqu\u2019un qui regarde peu de films', sub:'ça doit rester simple', social:'novice'}]},
    {id:'duree', kicker:'Ton temps', titre:'Tu as combien de temps devant toi ?', options:[
      {v:'court', l:'Pas trop long', sub:'moins de 1h45', runtime:[0, 105], ideal:92},
      {v:'normal', l:'Une soirée classique', sub:'environ 1h30 à 2h15', runtime:[88, 135], ideal:112},
      {v:'long', l:'Toute la soirée', sub:'2h et plus, ça me va', runtime:[118, 400], ideal:145},
      {v:'libre', l:'Peu importe', sub:'aucune contrainte', runtime:[0, 400], ideal:null, freeRuntime:true}]},
    {id:'epoque', kicker:'Ton époque', titre:'Plutôt récent ou plutôt ancien ?', options:[
      {v:'recent', l:'Récent', sub:'2010 et après', years:[2010, 2030]},
      {v:'moderne', l:'Années 80 à 2000', sub:'les classiques modernes', years:[1980, 2009]},
      {v:'vieux', l:'Ancien', sub:'avant 1980', years:[1930, 1979]},
      {v:'libre', l:'Peu importe', sub:'toutes époques', years:[1920, 2030]}]},
    {id:'notoriete', kicker:'Dernière question', titre:'Un film connu, ou une découverte ?', options:[
      {v:'sur', l:'Un film connu', sub:'peu de risque', votes:[1500, null], note:6.6, axe:'consensus'},
      {v:'pepite', l:'Une découverte', sub:'moins vu, mais bien noté', votes:[150, 3000], note:6.8, axe:'oublie'},
      {v:'libre', l:'Peu importe', sub:'surprends-moi', votes:[150, null], note:6.2, axe:'note'}]}

  ];

  var TOTAL = 2 + REST.length;   /* humeur + envie + 5 questions larges */

  function questionAt(i, path) {
    if (i === 0) return Q1;
    if (i === 1) { var m = path[0]; return (m && (FEEL_BRANCH[m.value] || BRANCH[m.value])) || REST[0]; }
    return REST[i - 2] || null;
  }
  function microQuestionAt(i, path) {
    if (i === 2) {
      var b = path[1];
      if (b && b.micro && b.micro.length) {
        return {id: 'micro', kicker: 'Plus précisément', titre: b.mtitre || (MICRO[b.value] || {}).titre || 'Plus précisément ?',
          options: b.micro.map(function (ref) {
            var o = MICRO_BY_V[ref[0]] || {};
            return Object.assign({}, o, ref[1] ? {l: ref[1]} : {}, ref[2] ? {sub: ref[2]} : {});
          }).filter(function (o) { return o.v; })};
      }
      return (b && MICRO[b.value]) || REST[0];
    }
    return REST[i - 3] || null;
  }

  /* ---------- l'humeur de départ fixe le cap ----------
     core   : familles de genres dans lesquelles le film DOIT s'inscrire
     forbid : genres incompatibles avec l'humeur (jamais levés, même en élargissant)
     offLead: genres qui ne peuvent pas être le genre principal du film
              (ex. « avoir peur » : un film d'action avec un peu de suspense est écarté) */
  var MOOD_RULES = {
    rire:       {core:[35],                 forbid:[27, 53, 10752],        offLead:[18, 80, 28, 878, 9648, 36]},
    peur:       {core:[27, 53],             forbid:[35, 10751, 16, 10749, 10402], offLead:[28, 12, 80, 18, 14, 10752, 9648, 878]},
    reflechir:  {core:[18, 9648, 878, 36],  forbid:[16, 10751],            offLead:[28, 35, 27, 12, 10749]},
    emotion:    {core:[18, 10749, 10402, 10751], forbid:[27, 53],          offLead:[28, 35, 878, 80]},
    adrenaline: {core:[28, 53, 80, 10752],  forbid:[10751, 16, 10749, 10402], offLead:[18, 35, 27]},
    evasion:    {core:[878, 14, 12, 16],    forbid:[27, 10752],            offLead:[18, 53, 80]},
    surprise:   {core:[9648, 53, 14, 878],  forbid:[10751, 16],            offLead:[28, 35, 10749]},
    detente:    {core:[35, 10751, 12, 16],  forbid:[27, 53, 10752, 80],    offLead:[18]}
  };
  function inter(a, b) { return a.filter(function (x) { return b.indexOf(x) > -1; }); }

  /* l'affinage (2ᵉ question) précise encore :
     need : le film doit contenir au moins un de ces genres
     lead : son genre principal doit être l'un de ceux-là */
  var SUB_RULES = {
    peur:       {psy:{lead:[53], need:[53, 9648, 27], no:[28, 12, 35, 878, 10752]}, horreur:{need:[27], lead:[27]}, surnaturel:{need:[27], also:[14, 9648, 878]}, survie:{need:[27], lead:[27, 53], also:[28, 12, 878, 53]}},
    rire:       {tendre:{no:[28, 80]}, absurde:{}, romantique:{need:[10749]}, grincant:{}},
    reflechir:  {societe:{lead:[18]}, esprit:{need:[9648, 53, 18], also:[9648, 53]}, histoire:{need:[36]}, futur:{need:[878], also:[18, 9648, 53], no:[28]}},
    emotion:    {melo:{lead:[18], no:[16, 35]}, amour:{need:[10749]}, famille:{need:[10751, 18], lead:[18, 10751], no:[10752, 28, 80, 53]}, musique:{need:[10402]}},
    adrenaline: {action:{lead:[28]}, poursuite:{need:[28], lead:[28, 53]}, braquage:{need:[80], lead:[80, 53], also:[53, 28], no:[9648, 27, 10752, 18, 35]}, guerre:{need:[10752]}},
    surprise:   {twist:{need:[9648, 53], lead:[9648, 53, 80, 18, 27], no:[12, 10751]}, etrange:{need:[14, 878], no:[28, 12, 10751]}, vrai:{need:[36, 80]}, melange:{}},
    detente:    {feelgood:{need:[35]}, doudou:{need:[16, 10751], lead:[16, 10751, 35]}, legere:{need:[12]}, popcorn:{need:[28, 12, 35], lead:[28, 12, 878, 14, 35]}},
    evasion:    {sf:{need:[878], lead:[878, 14, 16]}, fantastique:{need:[14]}, aventure:{need:[12], lead:[12, 878, 14]}, anim:{need:[16]}}
  };

  /* ---------- réponses → profil de requête ---------- */
  function profile(path) {
    var p = {genres: [], without: [], pair: null, runtime: [60, 400], ideal: 120, years: [1920, 2030],
      lang: null, votes: [200, null], note: 6.3, social: null, rythme: 'moyen', exigence: 'entre', freeRuntime: true,
      axe: 'note', intensity: 2, certif: false, labels: [], set: {},
      mood: null, core: [], forbid: [], offLead: [], bonus: []};
    var moodA = null, subA = null, microA = null, refine = [], extra = [], pairs = [];
    path.forEach(function (a) {
      if (a.label) p.labels.push(a.label);
      if (a.q === 'mood') moodA = a;
      if (a.q === 'feel') return;   /* le ressenti n'est qu'une porte d'entrée : il ne porte aucun genre */
      if (a.q === 'sub') subA = a;
      if (a.q === 'micro') microA = a;
      if (a.q === 'sub' || a.q === 'micro') (a.genres || []).concat(a.pair || []).forEach(function (g) { refine.push(g); });
      else (a.genres || []).forEach(function (g) { extra.push(g); });
      if (a.pair && a.pair.length === 2) pairs.push(a.pair);
      (a.without || []).forEach(function (g) { if (p.without.indexOf(g) === -1) p.without.push(g); });
      if (a.runtime) { p.runtime = a.runtime; p.ideal = a.ideal; p.freeRuntime = !!a.freeRuntime;
        if (!a.freeRuntime) p.set.runtime = 1; }
      if (a.years) { p.years = a.years; p.set.years = 1; }
      if (a.lang) { p.lang = a.lang; p.set.lang = 1; }
      if (a.votes) { p.votes = a.votes; p.note = a.note; }
      if (a.social) { p.social = a.social; p.set.social = 1; }
      if (a.rythme) { p.rythme = a.rythme; p.set.ton = 1; }
      if (a.exigence) { p.exigence = a.exigence; p.set.ton = 1; }
      if (a.axe) { p.axe = a.axe; p.set.axe = 1; }
      if (a.intensity != null) { p.intensity = a.intensity; p.set.intensity = 1; }
      if (a.certif) p.certif = true;
    });
    if (!moodA && subA && subA.mood) {
      var mo = MOODS.options.filter(function (o) { return o.v === subA.mood; })[0] || {};
      moodA = {q: 'mood', value: subA.mood, v: subA.mood, label: mo.l, genres: (mo.genres || []).slice()};
      (moodA.genres || []).forEach(function (g) { extra.push(g); });
    }
    /* le cap : l'humeur choisie en premier */
    var rule = moodA && MOOD_RULES[moodA.value || moodA.v];
    if (rule) {
      p.mood = moodA.value || moodA.v;
      p.core = rule.core.slice();
      p.forbid = rule.forbid.slice();
      p.offLead = rule.offLead.slice();
      /* l'affinage reste DANS le cap : seuls ses genres compatibles avec l'humeur comptent */
      var inCap = inter(refine, p.core);
      p.genres = inCap.length ? uniq(inCap) : p.core.slice();
      /* le reste (ex. « survie » → action) devient une nuance, jamais un genre principal */
      p.bonus = uniq(refine.concat(extra)).filter(function (g) {
        return p.genres.indexOf(g) === -1 && p.forbid.indexOf(g) === -1;
      });
    } else {
      p.genres = uniq(refine.concat(extra, moodA ? (moodA.genres || []) : []));
    }
    p.subKey = subA ? (subA.value || subA.v) : null;
    var sr = rule && subA && SUB_RULES[p.mood] && SUB_RULES[p.mood][subA.value || subA.v];
    p.need = sr && sr.need ? sr.need.slice() : null;
    p.lead = sr && sr.lead ? sr.lead.slice() : null;
    p.also = sr && sr.also ? sr.also.slice() : null;
    /* ce que le sous-choix écarte ne peut pas rester dans les genres demandés */
    if (sr && sr.no) {
      var keep = p.genres.filter(function (g) { return sr.no.indexOf(g) === -1; });
      p.genres = keep.length ? keep : p.core.filter(function (g) { return sr.no.indexOf(g) === -1; });
    }
    /* genres que ce sous-choix écarte en plus (ex. tension psychologique : pas d'action) */
    if (sr && sr.no) sr.no.forEach(function (g) { if (p.forbid.indexOf(g) === -1) p.forbid.push(g); });
    /* les nuances de l'affinage pèsent plus que celles des autres questions */
    p.subBonus = rule ? uniq(refine).filter(function (g) { return p.genres.indexOf(g) === -1 && p.forbid.indexOf(g) === -1; }) : [];
    /* un croisement exact n'est gardé que s'il respecte le cap */
    pairs.forEach(function (pr) {
      if (!rule || (inter(pr, p.forbid).length === 0 && inter(pr, p.core).length > 0)) p.pair = pr;
    });
    /* L'AFFINAGE FAIT FOI
       C'est la réponse la plus précise du parcours : « Un casse à l'humour »,
       « Un braquage réjouissant »… Ses genres sont exigés ensemble, et levés
       des interdits génériques de l'humeur qui les contrediraient. Sans ça,
       un choix explicite pouvait être ignoré et le moteur retombait sur les
       genres larges de l'humeur (d'où de l'animation pour un braquage). */
    var mp = microA && microA.pair && microA.pair.length ? microA.pair.slice() : null;
    if (rule && mp) {
      p.forbid = p.forbid.filter(function (g) { return mp.indexOf(g) === -1; });
      p.offLead = p.offLead.filter(function (g) { return mp.indexOf(g) === -1; });
      p.genres = mp.slice();
      var parMot = !!MICRO_KW[(microA.value || microA.v)];
      /* croisement exact exigé, sauf si l'intention passe par les mots-clés
         (un film de casse n'est pas forcément étiqueté « action ») */
      p.pair = mp.length === 2 && !parMot ? mp : null;
      p.need = mp.length === 1 ? mp.slice() : (parMot ? [mp[0]] : null);
      p.lead = p.lead ? uniq(p.lead.concat(mp)) : null;
      p.also = null;
      p.micro = mp;
      if (MICRO_LIFT[(microA.value || microA.v)]) MICRO_LIFT[(microA.value || microA.v)].forEach(function (g) {
        p.forbid = p.forbid.filter(function (x) { return x !== g; });
        p.without = p.without.filter(function (x) { return x !== g; });
      });
    }
    p.microKey = microA ? (microA.value || microA.v) : null;
    /* l'animation n'apparaît que si elle est demandée explicitement
       (le genre « familial », lui, reste réglé humeur par humeur) */
    if (rule && p.genres.indexOf(G.animation) === -1 && p.forbid.indexOf(G.animation) === -1
        && p.social !== 'enfants' && p.social !== 'famille') p.forbid.push(G.animation);
    if (p.social === 'enfants') p.forbid = p.forbid.filter(function (g) { return g !== G.animation && g !== G.famille; });
    p.veto = p.without.filter(function (g) { return p.genres.indexOf(g) === -1; });   /* refus explicites, avant les interdits liés à l'humeur */
    p.forbid.forEach(function (g) { if (p.without.indexOf(g) === -1) p.without.push(g); });
    [G.doc, 10770].forEach(function (g) {
      if (p.genres.indexOf(g) === -1 && p.without.indexOf(g) === -1) p.without.push(g);
    });
    p.without = p.without.filter(function (g) { return p.genres.indexOf(g) === -1; });
    p.forbid = p.forbid.filter(function (g) { return p.genres.indexOf(g) === -1; });
    return p;
  }

  var INT_TXT = ['très douce', 'douce', 'moyenne', 'forte', 'maximale'];
  var INT_WANT = [1.1, 1.9, 2.7, 3.9, 4.8];
  /* Un long métrage fait au moins une heure. Ce plancher ne dépend d'aucune
     réponse : « peu importe la durée » ne veut pas dire « un film de 4 minutes ». */
  var MIN_LONG = 60;

  function query(p, page, sort) {
    var q = {
      with_genres: p.pair ? p.pair.join(',') : p.genres.join('|'),
      without_genres: p.without.join(','),
      'vote_count.gte': p.votes[0],
      'vote_average.gte': p.note,
      'primary_release_date.gte': p.years[0] + '-01-01',
      'primary_release_date.lte': p.years[1] + '-12-31',
      'with_runtime.gte': Math.max(MIN_LONG, p.runtime[0]),   /* jamais de court métrage */
      'with_runtime.lte': p.runtime[1],
      sort_by: sort || sortFor(p),
      page: page || 1
    };
    if (p.votes[1]) q['vote_count.lte'] = p.votes[1];
    if (p.lang) q.with_original_language = p.lang;
    if (p.certif) { q.certification_country = 'FR'; q['certification.lte'] = '12'; }
    return q;
  }
  function sortFor(p) {
    if (p.axe === 'populaire') return 'popularity.desc';
    if (p.axe === 'nouveau') return 'primary_release_date.desc';
    if (p.axe === 'consensus') return 'vote_count.desc';
    if (p.axe === 'oublie') return 'vote_average.desc';
    return 'vote_average.desc';
  }

  /* filtres lisibles, affichés à l'utilisateur : rien n'est caché */
  function filterChips(p) {
    var c = [];
    if (p.pair) c.push('croisement : ' + p.pair.map(function (g) { return GENRE_FR[g]; }).join(' + '));
    else if (p.genres.length) c.push('genres : ' + p.genres.map(function (g) { return GENRE_FR[g]; }).join(' ou '));
    if (p.without.length) c.push('sans : ' + p.without.map(function (g) { return GENRE_FR[g]; }).join(', '));
    c.push(p.freeRuntime ? 'durée : sans contrainte'
      : 'durée ' + p.runtime[0] + '–' + p.runtime[1] + ' min (cible ' + p.ideal + ')');
    c.push('intensité visée ' + INT_TXT[p.intensity]);
    c.push('sortie ' + p.years[0] + '–' + p.years[1]);
    c.push('note ≥ ' + p.note.toFixed(1));
    c.push(p.votes[1] ? p.votes[0] + '–' + p.votes[1] + ' votes' : p.votes[0] + '+ votes');
    if (p.lang) c.push('langue : ' + p.lang.split('|').join('/'));
    if (p.certif) c.push('tous publics (≤ 12)');
    return c;
  }

  /* ---------- re-classement déterministe ---------- */
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* intensité intrinsèque d'un film, déduite de ses genres (1 = doux → 5 = extrême) */
  var HEAT = {};
  HEAT[G.horreur] = 5; HEAT[G.guerre] = 4.6; HEAT[G.thriller] = 4.2; HEAT[G.action] = 4;
  HEAT[G.crime] = 3.8; HEAT[G.mystere] = 3.2; HEAT[G.western] = 3.4; HEAT[G.sf] = 3;
  HEAT[G.aventure] = 2.8; HEAT[G.drame] = 2.8; HEAT[G.histoire] = 3; HEAT[G.fantastique] = 2.6;
  HEAT[G.musique] = 1.8; HEAT[G.animation] = 1.8; HEAT[G.romance] = 1.6; HEAT[G.comedie] = 1.5;
  HEAT[G.famille] = 1.2;
  function heatOf(gs) {
    var vals = gs.map(function (g) { return HEAT[g]; }).filter(function (v) { return v; });
    if (!vals.length) return 2.6;
    var max = Math.max.apply(null, vals);
    var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return max * 0.65 + avg * 0.35;
  }

  /* PORTE D'ÉLIGIBILITÉ
     Le score classe ; cette fonction, elle, exclut. Un film qui contredit un
     choix explicite ne peut plus apparaître, quel que soit son score par
     ailleurs. TMDB étant permissif (un « ou » sur les genres, des dates
     approximatives), on revérifie tout côté client. */
  function eligible(m, p) {
    var gs = m.genre_ids || [];
    if (!gs.length) return false;
    if (p.without.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.pair && !p.pair.every(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.genres.length && !p.genres.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    /* le cap de l'humeur ne se négocie jamais, même en élargissant */
    if ((p.forbid || []).some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if ((p.offLead || []).indexOf(gs[0]) > -1) return false;
    if (p.need && !p.need.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.lead && p.lead.indexOf(gs[0]) === -1) return false;
    if (p.also && !p.also.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.mood && p.genres.length && !p.genres.some(function (g) { return gs.slice(0, 2).indexOf(g) > -1; })) return false;
    var y = parseInt((m.release_date || '').slice(0, 4), 10);
    if (y && (y < p.years[0] || y > p.years[1])) return false;
    if (typeof m.vote_average === 'number' && m.vote_average < p.note - 0.05) return false;
    if (typeof m.vote_count === 'number' && m.vote_count < p.votes[0]) return false;
    if (p.votes[1] && m.vote_count > p.votes[1]) return false;
    if (p.lang && p.lang.split('|').indexOf(m.original_language) === -1) return false;
    return true;
  }

  function scoreOne(m, p) {
    var gs = m.genre_ids || [];
    var hit = p.genres.filter(function (g) { return gs.indexOf(g) > -1; }).length;

    /* Le genre ne se contente plus de « au moins un tag en commun ».
       On mesure deux choses : combien des genres demandés sont couverts (rappel),
       et quelle part du film relève réellement de ces genres (précision). Un film
       qui ne coche AUCUN genre demandé chute à 8 : il ne peut plus passer devant. */
    var genre;
    if (!p.genres.length) genre = 70;
    else if (!hit) genre = 8;
    else {
      var rappel = Math.min(1, hit / Math.min(p.genres.length, 2));
      var precision = Math.min(1, hit / Math.max(1, gs.length) * 1.7);
      genre = clamp(100 * (0.60 * rappel + 0.40 * precision), 0, 100);
    }
    if (hit && p.genres.indexOf(gs[0]) > -1) genre = Math.min(100, genre + 10);
    if ((p.subBonus || []).some(function (g) { return gs.indexOf(g) > -1; })) genre = Math.min(100, genre + 14);
    else if ((p.bonus || []).some(function (g) { return gs.indexOf(g) > -1; })) genre = Math.min(100, genre + 5);
    if (p.pair && p.pair.every(function (g) { return gs.indexOf(g) > -1; })) genre = 100;
    if (p.without.some(function (g) { return gs.indexOf(g) > -1; })) genre -= 55;
    genre = clamp(genre, 0, 100);

    /* intensité : distance entre ce que le film dégage et ce qui a été demandé */
    var want = INT_WANT[p.intensity]; if (want == null) want = 2.7;
    var intensite = clamp(100 - Math.abs(heatOf(gs) - want) * 26, 0, 100);

    var year = parseInt((m.release_date || '0000').slice(0, 4), 10) || 0;
    var mid = (p.years[0] + p.years[1]) / 2, span = Math.max(6, (p.years[1] - p.years[0]) / 2);
    var epoque = clamp(100 - Math.abs(year - mid) / span * 42, 20, 100);
    if (p.axe === 'nouveau') epoque = clamp(40 + (year - 2015) * 7, 10, 100);

    var note = clamp((m.vote_average - 5.5) * 22, 0, 100);
    var conf = clamp(Math.log10(Math.max(10, m.vote_count)) / 5 * 100, 0, 100);
    var pop = clamp(Math.log10(Math.max(1, m.popularity)) / 3 * 100, 0, 100);

    var notoriete;
    if (p.axe === 'populaire') notoriete = pop;
    else if (p.axe === 'consensus') notoriete = conf * 0.62 + note * 0.38;
    else if (p.axe === 'oublie') notoriete = clamp(112 - pop, 0, 100) * 0.6 + note * 0.4;
    else notoriete = conf * 0.45 + note * 0.55;

    var social = 70;
    if (p.social === 'famille') social = gs.indexOf(G.famille) > -1 || gs.indexOf(G.animation) > -1 ? 98 : 54;
    if (p.social === 'couple') social = gs.indexOf(G.romance) > -1 || gs.indexOf(G.drame) > -1 ? 94 : 66;
    if (p.social === 'amis') social = gs.indexOf(G.comedie) > -1 || gs.indexOf(G.action) > -1 || gs.indexOf(G.horreur) > -1 ? 94 : 62;
    if (p.social === 'seul') social = gs.indexOf(G.drame) > -1 || gs.indexOf(G.mystere) > -1 || gs.indexOf(G.sf) > -1 ? 92 : 68;
    if (p.social === 'enfants') social = gs.indexOf(G.animation) > -1 || gs.indexOf(G.famille) > -1 ? 99 : 40;
    if (p.social === 'novice') social = clamp(38 + pop * 0.5 + (gs.indexOf(G.comedie) > -1 || gs.indexOf(G.action) > -1 ? 16 : 0), 0, 100);

    var ton = 70;
    if (p.rythme === 'nerveux') ton = pop * 0.4 + (gs.indexOf(G.action) > -1 || gs.indexOf(G.thriller) > -1 ? 58 : 18);
    if (p.rythme === 'contemplatif') ton = note * 0.45 + (gs.indexOf(G.drame) > -1 || gs.indexOf(G.histoire) > -1 ? 52 : 16);
    if (p.rythme === 'alterne') ton = clamp(52 + (gs.length >= 2 ? 30 : 0) + note * 0.18, 0, 100);
    if (p.exigence === 'accessible') ton = ton * 0.5 + conf * 0.5;
    if (p.exigence === 'exigeant') ton = ton * 0.5 + note * 0.5;
    ton = clamp(ton, 0, 100);

    /* Les poids suivent les réponses : ce que l'utilisateur a explicitement
       choisi pèse plus lourd que les valeurs par défaut du moteur. */
    var W = {genre: .26, intensite: .15, note: .14, social: .12, notoriete: .11, epoque: .09, ton: .08};
    if (p.pair) W.genre += .11;
    else if (p.genres.length && p.genres.length <= 3) W.genre += .06;
    if (p.set.intensity) W.intensite += (p.intensity === 0 || p.intensity === 4) ? .10 : .06;
    if (p.set.social) W.social += .06;
    if (p.set.years) W.epoque += .07;
    if (p.set.axe) W.notoriete += .06;
    if (p.set.ton) W.ton += .06;
    var somme = 0, k;
    for (k in W) somme += W[k];
    for (k in W) W[k] = W[k] / somme;

    var g = W.genre * genre + W.intensite * intensite + W.note * note + W.social * social
      + W.notoriete * notoriete + W.epoque * epoque + W.ton * ton;
    return {
      raw: g,
      global: Math.round(clamp(g, 5, 99)),
      criteria: [
        {k: 'genre', l: 'Genre', v: Math.round(genre)},
        {k: 'intensite', l: 'Intensité', v: Math.round(intensite)},
        {k: 'note', l: 'Qualité', v: Math.round(note)},
        {k: 'social', l: 'Contexte', v: Math.round(social)},
        {k: 'notoriete', l: 'Notoriété', v: Math.round(notoriete)},
        {k: 'epoque', l: 'Époque', v: Math.round(epoque)},
        {k: 'ton', l: 'Ton', v: Math.round(ton)}
      ]
    };
  }

  /* genre grammatical des noms de genres, pour éviter « c'est du comédie » */
  var FEM = {35:1, 10749:1, 12:1, 16:1, 878:1, 10752:1, 36:1, 10402:1, 10751:1};
  function duGenre(id) {
    var n = (GENRE_FR[id] || '').toLowerCase();
    return (FEM[id] ? 'de la ' : 'du ') + n;
  }
  function aGenre(id) {
    var n = (GENRE_FR[id] || '').toLowerCase();
    return (FEM[id] ? 'à la ' : 'au ') + n;
  }

  var SOC = {seul:'en solo', couple:'à deux', amis:'entre amis', famille:'en famille',
    enfants:'avec des enfants', novice:'avec quelqu\u2019un qui regarde peu de films'};

  function why(m, sc, p, details) {
    var gs = (m.genre_ids || []);
    var bits = [];
    var hits = gs.filter(function (g) { return p.genres.indexOf(g) > -1; });
    if (p.pair && p.pair.every(function (g) { return gs.indexOf(g) > -1; })) {
      bits.push('il croise exactement ' + p.pair.map(function (g) { return GENRE_FR[g].toLowerCase(); }).join(' et '));
    } else if (hits.length >= 2) {
      bits.push('c\u2019est ' + duGenre(hits[0]) + ' mêlé ' + aGenre(hits[1]));
    } else if (hits.length === 1) {
      bits.push('c\u2019est ' + duGenre(hits[0]));
    }
    var h = heatOf(gs), asked = INT_WANT[p.intensity]; if (asked == null) asked = 2.7;
    var gap = Math.abs(h - asked);
    bits.push(gap < 0.55 ? 'une intensité ' + INT_TXT[p.intensity] + ', exactement ton niveau'
      : gap < 1.2 ? 'une intensité proche de ton niveau (' + INT_TXT[p.intensity] + ' demandée)'
      : h > asked ? 'un cran au-dessus de l\u2019intensité demandée'
      : 'un cran en dessous de l\u2019intensité demandée');
    if (details && details.runtime) {
      bits.push(p.freeRuntime ? fmt(details.runtime)
        : fmt(details.runtime) + (Math.abs(details.runtime - p.ideal) <= 12 ? ', pile ta durée' : ', dans ton créneau'));
    }
    if (sc.ambiance && sc.ambiance.hits.length) bits.push('ambiance ' + sc.ambiance.hits.join(', '));
    bits.push('noté ' + m.vote_average.toFixed(1) + '/10 sur ' + m.vote_count.toLocaleString('fr-FR') + ' votes');
    if (p.social) bits.push('ça tient ' + SOC[p.social]);
    if (bits.length) bits[0] = bits[0].charAt(0).toUpperCase() + bits[0].slice(1);
    return bits.join(' · ') + '.';
  }

  function fmt(m) { return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }

  /* élargissement progressif : on garde le cap, on ouvre les vannes */
  /* on lâche du plus secondaire au plus essentiel : notoriété → époque → durée → langue → genre */
  function widen(p, round) {
    if (!round) return p;
    var w = JSON.parse(JSON.stringify(p));
    w.note = Math.max(5.6, p.note - 0.3 * round);
    w.votes = [Math.max(120, Math.round(p.votes[0] / (1 + round))), p.votes[1] ? p.votes[1] * (1 + round) : null];
    if (round >= 2) w.years = [Math.max(1920, p.years[0] - 8 * (round - 1)), Math.min(2030, p.years[1] + 8 * (round - 1))];
    if (round >= 3) w.runtime = [Math.max(MIN_LONG, p.runtime[0] - 20 * (round - 2)), Math.min(400, p.runtime[1] + 25 * (round - 2))];
    if (round >= 4) { w.lang = null; w.also = null; }   /* le cap (humeur, interdits, genre de tête) ne bouge jamais */
    if (round >= 5) w.pair = null;
    if (round >= 6) w.without = [];
    return w;
  }
  var STEPS = ['', 'la notoriété', 'les années de sortie', 'la durée', 'la langue', 'le croisement de genres', 'tout le reste'];
  /* relance demandée */
  var RELAX_MSG = ['', 'Je garde ton cap et j\u2019ouvre sur la notoriété.',
    'J\u2019élargis les années de sortie — ton registre ne bouge pas.',
    'J\u2019ouvre aussi la durée, toujours dans le même genre.',
    'J\u2019ouvre à toutes les langues pour continuer à te proposer autre chose.',
    'Je décroise les genres : ton mood reste le même, les profils changent.',
    'On est au bout du filon : voici ce qui reste de plus proche de tes réponses.'];
  function relaxMessage(round) { return RELAX_MSG[Math.min(round, RELAX_MSG.length - 1)]; }
  /* repli automatique, jamais demandé par l'utilisateur : on le dit tel quel */
  function fallbackMessage(round) {
    var opened = STEPS.slice(1, Math.min(round, STEPS.length - 1) + 1).filter(Boolean);
    return 'Trop peu de films correspondent à ce chemin exact. Pour t\u2019en proposer quand même, j\u2019ai ouvert '
      + opened.join(', ').replace(/,([^,]*)$/, ' et$1') + ' — le reste de tes réponses est intact.';
  }

  /* Le meilleur match reste le meilleur. Les alternatives, elles, doivent
     apporter un vrai contraste : on pénalise légèrement un candidat qui
     ressemble trop à ce qui est déjà retenu — jamais assez pour faire passer
     un film moins pertinent devant un film nettement plus juste. */
  function proximite(a, b) {
    var x = a.movie.genre_ids || [], y = b.movie.genre_ids || [];
    if (!x.length || !y.length) return 0;
    var inter = x.filter(function (g) { return y.indexOf(g) > -1; }).length;
    return inter / Math.max(1, Math.min(x.length, y.length));
  }
  function diversify(list, n) {
    if (list.length <= 1) return list.slice(0, n);
    var picked = [list[0]], rest = list.slice(1);
    while (picked.length < n && rest.length) {
      var bestI = 0, bestV = -1e9;
      rest.forEach(function (c, i) {
        var pen = 0;
        picked.forEach(function (q) { pen += proximite(c, q); });
        var v = c.raw - (pen / picked.length) * 9;
        if (v > bestV) { bestV = v; bestI = i; }
      });
      picked.push(rest.splice(bestI, 1)[0]);
    }
    return picked;
  }
  /* En quoi cette alternative diffère du meilleur match, dit en clair.
     Chaque étiquette n'est utilisée qu'une fois : cinq « Plus intense »
     n'apprendraient rien à l'utilisateur. */
  function profilOf(e, ref, used) {
    var gs = e.movie.genre_ids || [], rg = ref.movie.genre_ids || [];
    var h = heatOf(gs), hr = heatOf(rg);
    var cand = [];
    if (gs.indexOf(G.comedie) > -1 && rg.indexOf(G.comedie) === -1) cand.push('Plus drôle');
    if (h >= hr + 0.6) cand.push('Plus intense');
    if (h <= hr - 0.6) cand.push('Plus doux');
    if (e.runtime && ref.runtime && e.runtime <= ref.runtime - 18) cand.push('Plus court');
    if (e.runtime && ref.runtime && e.runtime >= ref.runtime + 25) cand.push('Plus ample');
    if (e.movie.popularity > ref.movie.popularity * 1.6) cand.push('Plus grand public');
    if (e.movie.popularity * 1.6 < ref.movie.popularity) cand.push('Plus confidentiel');
    if (e.movie.vote_average >= ref.movie.vote_average + 0.3) cand.push('Mieux noté');
    gs.filter(function (g) { return rg.indexOf(g) === -1 && GENRE_FR[g]; })
      .forEach(function (g) { cand.push('Plutôt ' + GENRE_FR[g].toLowerCase()); });
    var an = parseInt((e.movie.release_date || '').slice(0, 4), 10);
    var ar = parseInt((ref.movie.release_date || '').slice(0, 4), 10);
    if (an && ar && an >= ar + 12) cand.push('Plus récent');
    if (an && ar && an <= ar - 12) cand.push('Plus ancien');
    cand.push('Autre angle');
    for (var i = 0; i < cand.length; i++) if (used.indexOf(cand[i]) === -1) return cand[i];
    return 'Autre angle';
  }

  /* ---------- CONTRÔLE FINAL DE COHÉRENCE ----------
     Dernier filtre, appliqué aux films retenus juste avant l'affichage, sur leurs
     genres EXACTS (fiche détaillée, plus fiable que la liste de recherche).
     Il s'applique après tout le reste — élargissement, rattrapage, Duo — et
     rien ne peut le contourner :
       · animation seulement si elle est demandée (sous-choix) ou pour des enfants
       · « familial » en genre principal seulement si on regarde en famille
       · ni documentaire, ni téléfilm, sauf demande explicite
       · les interdits de l'humeur, revérifiés sur les genres exacts
       · un sous-choix précis (braquage, survie, histoire vraie…) doit être
         prouvé par les mots-clés du film, sinon le film sort */
  function exactGenres(e) {
    var d = e.details;
    return d && d.genres && d.genres.length ? d.genres.map(function (g) { return g.id; }) : (e.movie.genre_ids || []);
  }
  function wantsAnim(p) {
    return p.social === 'enfants' || (p.genres || []).indexOf(G.animation) > -1 || (p.micro || []).indexOf(G.animation) > -1;
  }
  /* le ton de l'humeur : au moins un de ces genres parmi les trois principaux du film */
  var TONE = {
    detente:    [35, 12, 10751, 16, 28, 14, 10402, 10749],
    rire:       [35],
    peur:       [27, 53],
    emotion:    [18, 10749, 10402, 10751],
    adrenaline: [28, 53, 80, 10752, 12],
    evasion:    [878, 14, 12, 16],
    reflechir:  [18, 9648, 878, 36],
    surprise:   [9648, 53, 14, 878, 27]
  };
  /* le genre, le public, le ton de l'humeur et les genres exigés par le sous-choix */
  function coherentBase(e, p, animOk) {
    var gs = exactGenres(e);
    if (!gs.length) return false;
    if (gs.indexOf(G.animation) > -1 && !animOk) return false;
    if (gs[0] === G.famille && p.social !== 'famille' && p.social !== 'enfants' && (p.genres || []).indexOf(G.famille) === -1) return false;
    if (gs.indexOf(G.doc) > -1 && (p.genres || []).indexOf(G.doc) === -1) return false;
    if (gs.indexOf(10770) > -1) return false;
    if (p.social === 'enfants' && gs.indexOf(G.famille) === -1 && gs.indexOf(G.animation) === -1) return false;
    if ((p.forbid || []).some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if ((p.veto || []).some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.mood && MOOD_RULES[p.mood]) {
      if ((p.offLead || []).indexOf(gs[0]) > -1) return false;
      var exempt = RESCUE_CORE_EXEMPT[p.mood] && RESCUE_CORE_EXEMPT[p.mood][p.subKey];
      var tone = TONE[p.mood] || [];
      if (!exempt && tone.length && !gs.slice(0, 3).some(function (g) { return tone.indexOf(g) > -1; })
          && frScore(e.details, p.mood) < 2) return false;   /* le synopsis peut rattraper un film mal classé */
    }
    return true;
  }
  /* le thème précis du sous-choix (braquage, survie…), prouvé par les genres exigés et les mots-clés */
  function coherentNeed(e, p) {
    var gs = exactGenres(e);
    var sr = p.mood && p.subKey && SUB_RULES[p.mood] && SUB_RULES[p.mood][p.subKey];
    var need = (sr && sr.need) || p.need;
    return !(need && need.length && !need.some(function (g) { return gs.indexOf(g) > -1; }));
  }
  function coherentKw(e, p) {
    var must = p.subKey && SUB_MUST[p.mood] && SUB_MUST[p.mood][p.subKey];
    if (!must) return true;
    if (!kwNames(e.details).length && !frSub(e.details, p)) return false;   /* ni mots-clés ni résumé pour prouver le thème */
    return !registre(e.details, p, false, e.movie).subMiss;
  }
  function coherentTheme(e, p) { return coherentNeed(e, p) && coherentKw(e, p); }
  function coherent(e, p, animOk) { return coherentBase(e, p, animOk) && coherentTheme(e, p); }

  /* le parcours complet : plusieurs pages de candidats → score → N films → détails exacts */
  function recommend(path, count, exclude, round, asked, carry) {
    round = round || 0;
    if (asked === undefined) asked = round;
    var strict = profile(path);
    var p = widen(strict, round);
    var tgt = moodTargets(strict);
    var first = 1 + round * 3;
    var pages = [first, first + 1, first + 2, first + 3, first + 4, first + 5].map(function (n) {
      return api('/discover/movie', query(p, n)).catch(function () { return {results: []}; });
    });
    return Promise.all([Promise.all(pages), rescuePool(p, round).catch(function () { return []; })]).then(function (both) {
      var rs = both[0], extra = both[1];
      var seen = {}, pool = [];
      rs.forEach(function (r) {
        (r.results || []).forEach(function (m) {
          if (!m.poster_path || seen[m.id]) return;
          if ((exclude || []).indexOf(m.id) > -1) return;
          if (!eligible(m, p)) return;   /* hors critères : écarté, pas seulement mal noté */
          seen[m.id] = 1; pool.push(m);
        });
      });
      /* rattrapage des films mal rangés par TMDB (confirmés plus loin par leurs mots-clés) */
      var nRes = 0;
      extra.forEach(function (m) {
        if (nRes >= 36 || !m.poster_path || seen[m.id]) return;
        if ((exclude || []).indexOf(m.id) > -1) return;
        if (!eligibleRescued(m, p)) return;
        seen[m.id] = 1; nRes++;
        pool.push(Object.assign({}, m, {__rescued: true}));
      });
      /* filet de sécurité : jamais d'écran vide, on élargit tout seul — et on le signale */
      if (pool.length < (count || 5) && round < 6) {
        return recommend(path, count, exclude, round + 1, (asked === undefined ? round : asked), carry);
      }
      var n = count || 5;
      var scored = pool.map(function (m) {
        var sc = scoreOne(asIfIn(m, strict), strict);
        return {movie: m, raw: sc.raw, global: sc.global, criteria: sc.criteria};
      }).sort(function (a, b) { return b.raw - a.raw || b.movie.vote_count - a.movie.vote_count; });
      /* on vérifie la durée EXACTE d'une présélection large, puis on re-classe */
      var normaux = scored.filter(function (e) { return !e.movie.__rescued; }).slice(0, n * 4);
      var rattr = scored.filter(function (e) { return e.movie.__rescued; }).slice(0, n * 2);
      var shortlist = normaux.concat(rattr);
      return Promise.all(shortlist.map(function (e) {
        return api('/movie/' + e.movie.id, {append_to_response: 'credits,keywords'}).catch(function () { return null; });
      })).then(function (details) {
        shortlist.forEach(function (e, i) {
          var d = details[i];
          e.details = d;
          e.runtime = d && d.runtime ? d.runtime : null;
          e.dureeTxt = e.runtime ? fmt(e.runtime) : '—';
          if (strict.freeRuntime) {
            /* la durée n'a pas été contrainte : elle ne pèse pas, sauf pour
               écarter ce qui n'est pas un long métrage */
            e.freeRuntime = true;
            if (e.runtime && e.runtime < MIN_LONG) e.raw = e.raw * 0.35;
          } else {
            /* durée choisie = vrai filtre : hors créneau, le film ne peut plus
               remonter dans le classement, même excellent par ailleurs. */
            var duree, marge;
            if (!e.runtime) duree = 55;
            else if (e.runtime < strict.runtime[0] || e.runtime > strict.runtime[1]) {
              marge = e.runtime < strict.runtime[0]
                ? strict.runtime[0] - e.runtime : e.runtime - strict.runtime[1];
              duree = clamp(24 - marge * 0.8, 2, 24);
            } else duree = clamp(100 - Math.abs(e.runtime - strict.ideal) * 1.5, 50, 100);
            e.criteria = e.criteria.concat([{k: 'duree', l: 'Durée', v: Math.round(duree)}]);
            e.raw = e.raw * 0.76 + duree * 0.24;
          }
          e.ambiance = ambiance(d, tgt);
          e.raw = e.raw * 0.8 + e.ambiance.v * 0.2;
          e.criteria = e.criteria.concat([{k: 'ambiance', l: 'Ambiance', v: e.ambiance.v}]);
          /* deuxième avis : les mots-clés confirment ou contredisent l'humeur */
          var rg = registre(d, strict, e.movie.__rescued, e.movie);
          e.registre = rg;
          e.raw += rg.bonus;
          e.global = Math.round(clamp(e.raw, 5, 99));
          e.realisateur = d && d.credits ? (d.credits.crew || []).filter(function (c) { return c.job === 'Director'; })[0] : null;
          e.genresTxt = d && d.genres ? d.genres.map(function (g) { return g.name; }).slice(0, 3).join(', ')
            : (e.movie.genre_ids || []).map(function (g) { return GENRE_FR[g]; }).filter(Boolean).slice(0, 3).join(', ');
        });
        shortlist = shortlist.filter(function (e) { return !e.ambiance.blocked && !e.registre.drop; });   /* registre interdit ou contredit : exclu */
        var animOk = wantsAnim(strict);
        shortlist = shortlist.filter(function (e) { return coherent(e, strict, animOk); });
        /* trop peu de films irréprochables : on cherche plus loin plutôt que de montrer un film à côté */
        var seenC = {};
        shortlist = (carry || []).concat(shortlist).filter(function (e) {
          if (seenC[e.movie.id]) return false; seenC[e.movie.id] = 1; return true;
        });
        if (shortlist.length < n && round < 5) {
          return recommend(path, count, exclude, round + 1, asked, shortlist);
        }
        /* même en élargissant, rien ne réunit la précision demandée : on retire la
           seule dernière nuance (3e question), jamais l'humeur ni le sous-choix, et on le dit */
        if (!shortlist.length && path.some(function (a) { return a.q === 'micro'; })) {
          var nuance = (path.filter(function (a) { return a.q === 'micro'; })[0] || {}).label || '';
          return recommend(path.filter(function (a) { return a.q !== 'micro'; }), count, exclude, 0).then(function (out) {
            out.autoWidened = true;
            out.relaxMessage = out.results.length
              ? 'Aucun film ne réunit exactement « ' + nuance + ' » avec tes autres réponses. Voici les plus proches de ton envie principale.'
              : 'Aucun film ne correspond vraiment à ce mélange de réponses. Change une réponse (le public ou le sous-choix) et relance.';
            return out;
          });
        }
        shortlist.sort(function (a, b) { return b.raw - a.raw || b.movie.vote_count - a.movie.vote_count; });
        /* durée réelle : on exclut pour de bon, on ne se contente pas de rétrograder.
           Si le filtre ne laisse plus rien, on garde le classement complet plutôt
           qu'un écran vide — et l'élargissement automatique prendra le relais. */
        var dansCreneau = shortlist.filter(function (e) {
          if (e.runtime && e.runtime < MIN_LONG) return false;
          if (strict.freeRuntime) return true;
          if (!e.runtime) return false;
          return e.runtime >= strict.runtime[0] && e.runtime <= strict.runtime[1];
        });
        var exacts = shortlist.filter(function (e) { return !e.registre.subMiss; });
        var exige = (SUB_MUST[strict.mood] && SUB_MUST[strict.mood][strict.subKey]) || MICRO_KW[strict.microKey];
        /* intention précise mais trop peu de films qui la respectent : on élargit
           (notoriété, époque…) plutôt que de montrer des films à côté */
        if (exige && exacts.length < Math.min(n, 3) && round < 4) {
          return recommend(path, count, exclude, round + 1, asked, carry);
        }
        /* les films exacts passent devant ; on ne réduit plus la liste en dessous de n */
        if (exacts.length >= n) shortlist = exacts;
        else if (exacts.length) shortlist = exacts.concat(shortlist.filter(function (e) { return exacts.indexOf(e) === -1; }));
        var nr = 0, capR = exige ? n : 2;
        shortlist = shortlist.filter(function (e) { if (!e.movie.__rescued) return true; nr++; return nr <= capR; });
        dansCreneau = dansCreneau.filter(function (e) { return shortlist.indexOf(e) > -1; });
        if (dansCreneau.length >= n) shortlist = dansCreneau;
        else if (dansCreneau.length) shortlist = dansCreneau.concat(
          shortlist.filter(function (e) { return dansCreneau.indexOf(e) === -1; }));
        shortlist.sort(function (a, b) { return b.raw - a.raw || b.movie.vote_count - a.movie.vote_count; });

        var top = diversify(shortlist, n);
        /* le meilleur reste en tête ; les alternatives se rangent par score
           décroissant, pour que l'affichage soit cohérent avec les chiffres */
        var tete = top.slice(0, 1);
        var suite = top.slice(1).sort(function (a, b) { return b.raw - a.raw; });
        top = tete.concat(suite);
        var vus = [], alt = top.slice(1);
        var sure = alt.slice().sort(function (a, b) { return b.movie.vote_count - a.movie.vote_count; })[0];
        var gem = alt.filter(function (e) { return e !== sure && e.movie.vote_average >= 6.8; })
          .sort(function (a, b) { return a.movie.popularity - b.movie.popularity; })[0];
        top.forEach(function (e, i) {
          e.rank = i;
          if (i === 0) e.profil = 'Le meilleur choix';
          else if (e === sure && alt.length >= 2) e.profil = 'La valeur sûre';
          else if (e === gem) e.profil = 'La pépite cachée';
          else { e.profil = profilOf(e, top[0], vus); vus.push(e.profil); }
          e.why = why(e.movie, e, strict, e.details);
        });
        var auto = round > asked;
        return {
          results: top, profile: p, total: pool.length,
          /* les filtres montrés restent ceux des réponses tant que l'utilisateur n'a rien demandé */
          chips: filterChips(auto ? strict : p),
          round: asked, autoWidened: auto || pont,
          relaxMessage: pont
            ? 'Vos envies sont différentes : voici les films qui réunissent le plus de réponses de vous deux.'
            : auto ? fallbackMessage(round) : relaxMessage(round)
        };
      });
    });
  }

  /* ===================== AMBIANCE (mots-clés TMDB) =====================
     Les genres disent de quoi parle un film, pas ce qu'on ressent devant.
     Chaque film TMDB porte des mots-clés (« feel-good », « plot twist »,
     « gore »…). On les lit pour chaque film présélectionné, on les compare
     à l'ambiance que tes réponses dessinent, et on écarte d'office la
     violence crue quand le contexte l'interdit (enfants, famille, très doux). */
  var AMB = {
    feel:    {fr: 'feel-good', re: /feel[- ]good|heartwarming|uplifting|optimis|kindness|hope|friendship/},
    rire:    {fr: 'humour', re: /comedy|slapstick|parody|satire|spoof|absurd|buddy|funny|farce/},
    tension: {fr: 'tension', re: /suspense|tension|cat and mouse|race against time|manhunt|hostage|paranoia/},
    twist:   {fr: 'rebondissements', re: /twist|surprise ending|unreliable narrator|nonlinear|mind ?bend|puzzle|whodunit/},
    peur:    {fr: 'frissons', re: /supernatural|haunted|ghost|demon|possession|slasher|jump scare|creature|monster|paranormal|witch/},
    sombre:  {fr: 'ambiance sombre', re: /\bdark\b|bleak|nihilis|dystopia|despair|tragedy|neo-noir|film noir/},
    emotion: {fr: 'émotion', re: /tearjerker|grief|loss of|terminal illness|mourning|melancholy|bittersweet|father son|mother daughter/},
    amour:   {fr: 'romance', re: /\blove\b|romance|relationship|first love|lovers|wedding|love triangle/},
    evasion: {fr: 'évasion', re: /road trip|journey|road movie|exotic|travel|quest|island|wilderness|space travel|epic|expedition/},
    pensee:  {fr: 'réflexion', re: /philosoph|existential|identity|memory|consciousness|artificial intelligence|morality|social commentary/},
    action:  {fr: 'action', re: /chase|heist|shootout|fight|martial arts|explosion|one man army|gunfight/},
    lent:    {fr: 'contemplatif', re: /slow cinema|character study|meditative|minimalis|contemplative|poetic/},
    famille: {fr: 'familial', re: /family|coming of age|childhood|animal|kids|children/},
    dur:     {fr: 'violence crue', re: /gore|torture|\brape\b|sexual violence|graphic violence|extreme violence|cannibal|body horror|child abuse|incest|snuff/}
  };
  function moodTargets(p) {
    var w = {}, a = {}, block = false;
    var add = function (o, k, v) { o[k] = Math.max(o[k] || 0, v); };
    var I = p.intensity, gs = p.genres || [];
    if (I <= 1) { add(w, 'feel', 1); add(a, 'sombre', 1); add(a, 'dur', 1.6); }
    if (I === 0) block = true;
    if (I >= 3) { add(w, 'tension', 1); add(a, 'feel', 0.5); }
    if (I === 4) add(w, 'sombre', 0.6);
    if (p.social === 'famille' || p.social === 'enfants') { add(w, 'famille', 1.2); add(a, 'dur', 2); add(a, 'sombre', 0.8); block = true; }
    if (p.social === 'couple') { add(w, 'amour', 0.7); add(a, 'dur', 1); }
    if (p.social === 'amis') { add(w, 'rire', 0.6); add(w, 'action', 0.5); }
    if (p.social === 'seul') { add(w, 'pensee', 0.5); add(w, 'twist', 0.5); }
    if (p.social === 'novice') { add(a, 'lent', 1); add(w, 'feel', 0.4); }
    if (p.rythme === 'nerveux') { add(w, 'action', 0.8); add(w, 'tension', 0.6); add(a, 'lent', 1); }
    if (p.rythme === 'contemplatif') { add(w, 'lent', 0.9); add(w, 'pensee', 0.5); add(a, 'action', 0.6); }
    if (p.exigence === 'exigeant') add(w, 'pensee', 0.7);
    if (p.exigence === 'accessible') add(a, 'lent', 0.8);
    var GW = {35: ['rire', .8], 27: ['peur', 1], 10749: ['amour', 1], 53: ['tension', .8], 80: ['tension', .7],
      878: ['pensee', .4], 12: ['evasion', .9], 18: ['emotion', .6], 9648: ['twist', .8], 28: ['action', .8],
      10751: ['famille', 1], 14: ['evasion', .6], 16: ['famille', .6]};
    gs.forEach(function (g) { if (GW[g]) add(w, GW[g][0], GW[g][1]); });
    var L = (p.labels || []).join(' ').toLowerCase();
    [[/rire|drôle|marrer|comique/, 'rire'], [/peur|frisson|flipp/, 'peur'], [/réfléch|cerveau|penser|intellig/, 'pensee'],
     [/émotion|pleur|touch|ému/, 'emotion'], [/surpr|retourn|twist|inattendu/, 'twist'], [/évad|voyag|ailleurs|dépays/, 'evasion'],
     [/action|adréna|explos/, 'action'], [/détente|léger|tranquille|cocoon|doux/, 'feel'], [/amour|romant/, 'amour'],
     [/tension|suspense|haleine/, 'tension']].forEach(function (r) { if (r[0].test(L)) add(w, r[1], 1); });
    Object.keys(a).forEach(function (k) { if (w[k]) delete a[k]; });   /* ce qu'on demande n'est pas pénalisé */
    return {want: w, avoid: a, block: block};
  }
  /* ---------- REGISTRE : deuxième avis, indépendant des genres ----------
     Les genres TMDB sont parfois faux ou incomplets. Les mots-clés du film
     (fantôme, braquage, deuil, parodie…) servent à :
       · confirmer que le film appartient vraiment à l'humeur choisie,
       · exclure un film qui la contredit sans rien pour la confirmer,
       · rattraper un film juste mais rangé dans le mauvais genre. */
  var REG = {
    peur:       {yes:/horror|slasher|haunt|ghost|demon|possess|exorcis|zombie|monster|creature|serial killer|killer|supernatural|paranormal|occult|witch|curse|vampire|werewolf|terror|psychological thriller|suspense|stalk|home invasion|gore|nightmare|found footage|psychopath|murder|kidnapp|paranoia|claustrophob|siege|trapped|survival|disaster|catastrophe|stranded|tsunami|earthquake|pandemic|shipwreck|avalanche|wilderness/,
                 no:/children'?s|kids|family film|animated|musical|sitcom|romantic comedy|christmas|holiday|coming of age|feel[- ]good/,
                 rescue:['horror','supernatural horror','slasher','haunted house','psychological horror']},
    rire:       {yes:/comedy|humou?r|satire|parody|spoof|slapstick|farce|absurd|buddy|funny|mockumentary|screwball|comedic|prank|hilarious|wacky|quirky|stand-up/,
                 no:/holocaust|genocide|concentration camp|war crimes|terminal illness|child abuse|\brape\b|torture|slasher/,
                 rescue:['comedy','satire','parody','black comedy','slapstick']},
    emotion:    {yes:/love|romance|grief|loss|friendship|tearjerker|coming of age|relationship|melodrama|tragedy|illness|cancer|mother|father|family|unrequited|longing|loneliness|redemption|death of|widow|orphan|reunion|first love|marriage|sacrifice/,
                 no:/slasher|gore|splatter|zombie|parody|spoof|slapstick/,
                 rescue:['tearjerker','melodrama','grief','love','romance']},
    adrenaline: {yes:/chase|heist|robbery|fight|martial arts|shootout|explosion|car chase|assassin|hitman|mercenary|hostage|race against time|battle|revenge|kung fu|gunfight|special forces|terroris|escape|spy|bomb|street race|cop|gangster|mafia|cartel|prison break|duel|ambush/,
                 no:/musical|romantic comedy|children'?s|kids|christmas/,
                 rescue:['heist','car chase','martial arts','hitman','revenge']},
    evasion:    {yes:/space|alien|dystopia|future|magic|fantasy|dragon|wizard|time travel|parallel|quest|adventure|myth|fairy tale|other world|planet|spaceship|robot|epic|kingdom|sword|treasure|journey|expedition|island|jungle|sorcer|enchant/,
                 no:/slasher|gore|\brape\b|torture|courtroom/,
                 rescue:['space travel','magic','time travel','fairy tale','sword and sorcery']},
    reflechir:  {yes:/philosoph|existential|social|politic|identity|memory|conscious|mind|psycholog|moral|society|class|artificial intelligence|biography|true story|history|justice|corruption|religion|surveillance|totalitarian|dystopia|human condition|ethic|investigat|journalis|war|trial|dilemma/,
                 no:/slapstick|spoof|parody|kids|children'?s|stoner/,
                 rescue:['philosophy','existentialism','dystopia','artificial intelligence','based on true story']},
    surprise:   {yes:/twist|nonlinear|surreal|mind[- ]?bend|unreliable narrator|mystery|whodunit|puzzle|dream|time loop|amnesia|conspiracy|identity|double life|doppelg|hallucinat|illusion|magician|parallel|alternate reality|split personality|cult film|bizarre|absurd|con artist|con man|fraud|scam|hoax|impostor|swindle|incredible true|unbelievable|escape|survival|kidnapping|cover-up/,
                 no:/children'?s|kids|family film|christmas/,
                 rescue:['plot twist','surrealism','time loop','unreliable narrator','whodunit']},
    detente:    {yes:/feel[- ]good|friendship|road trip|summer|heartwarming|buddy|family|vacation|comedy|holiday|christmas|dog|cat|animal|music|dance|cooking|food|small town|wholesome|underdog|sport|fairy tale|magic|adventure|friend/,
                 no:/gore|torture|\brape\b|serial killer|war crimes|genocide|suicide|child abuse|slasher|drug addiction|sexual violence|massacre/,
                 rescue:['feel-good','road trip','friendship','heartwarming','buddy comedy']}
  };
  /* affinage : mots-clés qui distinguent les sous-choix d'une même humeur */
  var SUB_KW = {
    peur:       {psy:/psycholog|paranoia|obsess|stalk|insan|mind game|gaslight|serial killer|madness|delusion/,
                 horreur:/slasher|gore|monster|zombie|killer|creature|body horror|splatter/,
                 surnaturel:/ghost|demon|possess|haunt|supernatural|paranormal|occult|witch|curse|exorcis/,
                 survie:/survival|trapped|stranded|isolation|creature|monster|wilderness|siege|hunt|escape/},
    rire:       {tendre:/feel[- ]good|friendship|heartwarming|family|coming of age/, absurde:/absurd|surreal|parody|spoof|slapstick|wacky/,
                 romantique:/romance|love|romantic comedy|wedding|dating/, grincant:/satire|black comedy|dark comedy|cynic|crime/},
    reflechir:  {societe:/social|politic|class|society|justice|corruption|racism|poverty/, esprit:/psycholog|mind|memory|identity|conscious|madness/,
                 histoire:/history|historical|biography|true story|war|period/, futur:/future|dystopia|artificial intelligence|robot|space|time travel/},
    emotion:    {melo:/tragedy|grief|loss|illness|death|tearjerker|melodrama/, amour:/love|romance|first love|unrequited|marriage|affair/,
                 famille:/family|mother|father|sibling|parent|child|reunion/, musique:/music|musician|singer|band|concert|dance/},
    adrenaline: {action:/fight|martial arts|shootout|explosion|battle|kung fu|gunfight/, poursuite:/chase|car chase|on the run|race against time|escape/,
                 braquage:/heist|robbery|bank|thief|con artist|caper/, guerre:/war|soldier|battle|military|world war/},
    surprise:   {twist:/twist|whodunit|mystery|unreliable|conspiracy/, etrange:/surreal|bizarre|absurd|dream|hallucinat/,
                 vrai:/true story|based on a true|based on true|biography|biographical|real events|real life|historical figure/, melange:/./},
    detente:    {feelgood:/feel[- ]good|heartwarming|friendship|underdog|uplifting/, doudou:/family|animal|dog|cat|fairy tale|christmas|magic/,
                 legere:/road trip|vacation|summer|adventure|journey/, popcorn:/adventure|chase|treasure|heist|superhero/},
    evasion:    {sf:/space|alien|planet|future|robot|spaceship|time travel/, fantastique:/magic|dragon|wizard|fairy tale|myth|sorcer|kingdom/,
                 aventure:/adventure|quest|treasure|expedition|journey|jungle|island/, anim:/./}
  };
  /* sous-choix que les genres ne savent pas exprimer : les mots-clés font foi */
  var SUB_MUST = {peur:{survie:1, surnaturel:1, psy:1}, surprise:{vrai:1, twist:1, etrange:1},
    adrenaline:{braquage:1, poursuite:1}, emotion:{musique:1, amour:1}, reflechir:{futur:1, esprit:1, societe:1},
    detente:{legere:1}, evasion:{aventure:1}};
  /* recherche par mots-clés propre au sous-choix : va chercher ce que les genres ratent */
  var SUB_RESCUE = {
    peur:       {survie:['survival', 'trapped', 'stranded', 'siege'], surnaturel:['ghost', 'demonic possession', 'haunted house', 'supernatural'],
                 psy:['psychological thriller', 'paranoia', 'obsession', 'stalker']},
    surprise:   {vrai:['based on true story', 'biography', 'true crime'], twist:['plot twist', 'twist ending', 'unreliable narrator'],
                 etrange:['surrealism', 'surreal', 'dream']},
    adrenaline: {braquage:['heist', 'bank robbery', 'robbery'], poursuite:['car chase', 'chase', 'on the run']},
    emotion:    {musique:['musician', 'singer', 'music', 'band'], amour:['love', 'romance', 'first love']},
    reflechir:  {futur:['dystopia', 'artificial intelligence', 'future'], esprit:['psychology', 'memory', 'identity'],
                 societe:['social issues', 'politics', 'class differences', 'racism']},
    detente:    {legere:['road trip', 'vacation', 'summer']},
    evasion:    {aventure:['adventure', 'treasure hunt', 'expedition']}
  };
  /* contradictions rédhibitoires : excluent même si d'autres indices vont dans le bon sens */
  var HARD = {
    detente: /drug|cocaine|heroin|\blsd\b|overdose|alcohol|drunk|addiction|gore|torture|\brape\b|serial killer|massacre|suicide|child abuse|sexual violence|incest|genocide|midlife crisis|depression|abus|brutal|dog fighting|gang violence|traumatic/,
    rire:    /holocaust|genocide|\brape\b|child abuse|sexual violence/,
    emotion: /slasher|splatter|gore/
  };
  /* genres qu'un affinage autorise en plus de son croisement */
  var MICRO_LIFT = {popcorn3: [53]};
  var MICRO_RESCUE = {
    popcorn3: ['heist', 'bank robbery', 'robbery'], braquage0: ['heist', 'bank robbery'], braquage1: ['heist', 'bank robbery', 'robbery'],
    braquage2: ['heist', 'robbery', 'caper'], vrai2: ['sports', 'survival', 'rescue'], poursuite1: ['spy', 'espionage', 'secret agent'],
    survie1: ['trapped', 'claustrophobia', 'siege'], survie2: ['post-apocalyptic future', 'apocalypse', 'dystopia'],
    sf0: ['space travel', 'outer space', 'astronaut'], musique0: ['biography', 'musician', 'singer'], melo2: ['based on true story', 'biography'],
    histoire2: ['true crime', 'based on true story'], vrai0: ['true crime', 'based on true story']
  };
  var HEIST = /heist|robbery|bank robber|robber|thief|thieves|burglar|caper|con artist|con man|safecracker|stolen money|armored car/;
  var MICRO_KW = {
    popcorn3: HEIST, braquage0: HEIST, braquage1: HEIST, braquage2: HEIST,
    vrai2: /sport|athlete|boxing|olympic|race|survival|rescue|expedition|mountain|stranded|coach|team/,
    vrai0: /true crime|murder|kidnapp|serial killer|crime|based on true|real events/,
    histoire2: /true crime|based on true|real events|murder|serial killer|kidnapp/,
    twist0: /investigat|detective|whodunit|murder mystery|police|inspector|private eye/,
    musique0: /biograph|musician|singer|rock star|composer|based on true/,
    melo2: /based on true|true story|biograph|real events/,
    poursuite1: /spy|espionage|secret agent|double agent|\bcia\b|\bmi6\b|kgb/,
    survie1: /trapped|claustrophob|siege|confined|locked in|locked room|buried alive|cave|bunker|stuck|isolation|home invasion|hostage/,
    survie2: /post-apocalyptic|apocalypse|dystopia|end of the world|zombie|pandemic|wasteland/,
    sf0: /space|astronaut|spaceship|spacecraft|planet|alien|galaxy|space station|mars|moon/,
    amour0: /love|romance|couple|relationship|affair/,
    guerre1: /world war|historical|based on true|19th century|20th century/
  };
  function kwNames(d) {
    return ((d && d.keywords && d.keywords.keywords) || []).map(function (k) { return String(k.name).toLowerCase(); });
  }
  /* ---------- SYNOPSIS : troisième avis, en français ----------
     Quand un film est mal classé par ses genres ou mal décrit par ses mots-clés,
     son résumé, lui, raconte vraiment de quoi il parle. On y cherche les mots
     qui confirment l'humeur, ceux qui la contredisent, et ceux du thème précis. */
  var REG_FR = {
    peur:       {yes:/terr[eio]|effroi|effray|horreu|cauchemar|hant[ée]|fantôme|démon|possé[dsé]|meurtri|tueur|massacr|monstre|créature|surnaturel|malédiction|maudit|traqu|piégé|angoiss|menace|sanglant|psychopathe|exorcis|vampire|zombie|sorcière/g,
                 no:/comédie|hilarant|loufoque|romance|comédie musicale/},
    rire:       {yes:/drôle|hilarant|comique|loufoque|farfelu|déjanté|gaffe|quiproquo|maladroit|parodi|satir|burlesque|cocasse|absurde|rocambolesque|catastrophique|improbable|délirant/g,
                 no:/génocide|holocauste|\bviol\b|torture|camp de concentration/},
    emotion:    {yes:/amour|deuil|perte|souvenir|cœur|larmes|émouv|tendresse|mère|père|enfance|maladie|séparation|retrouv|solitude|amitié|bouleversant|destin|sacrifice|adieu/g,
                 no:/tueur en série|massacre|slasher|parodie/},
    adrenaline: {yes:/poursuite|braquage|casse|explos|combat|fusillade|mercenaire|tueur à gages|vengeance|évasion|commando|otage|course contre la montre|gang|mafia|cartel|agent secret|cascade|affrontement|traque/g,
                 no:/comédie musicale|conte de fées|romance/},
    evasion:    {yes:/espace|planète|galaxie|futur|magie|magique|royaume|dragon|sorci|quête|voyage|aventure|trésor|\bîle\b|jungle|expédition|monde parallèle|extraterrestre|légende|fantastique/g,
                 no:/tueur en série|\bviol\b|torture|procès/},
    reflechir:  {yes:/société|politique|justice|pouvoir|mémoire|identité|conscience|morale|vérité|corruption|racisme|classe sociale|histoire vraie|procès|enquête|dilemme|condition humaine|liberté/g,
                 no:/parodie|loufoque|déjanté/},
    surprise:   {yes:/mystère|énigme|secret|révél|disparu|disparition|identité|réalité|rêve|illusion|manipul|double vie|étrange|inexplicable|histoire vraie|machination|bascule|vérité/g,
                 no:/conte de fées|comédie familiale/},
    detente:    {yes:/amitié|vacances|road trip|\bété\b|joyeux|réconfort|chaleureu|famille|chien|chat|aventure|fête|rencontre|bonne humeur|rêve|complicité|bande de copains/g,
                 no:/drogue|overdose|alcool|\bviol\b|meurtre|tueur|suicide|massacre|torture|guerre|deuil|cancer/}
  };
  var SUB_FR = {
    peur:       {psy:/paranoï|obsess|folie|manipul|harcel|psychologique|tueur|cauchemar|piège/, horreur:/horreur|massacr|monstre|tueur|sang|créature|zombie/,
                 surnaturel:/fantôme|hant|démon|possé|esprit|malédiction|surnaturel|exorcis|sorcière|maudit/, survie:/survi|piégé|traqu|enferm|isol|échapp|naufrag|perdu|apocalyps|chass/},
    rire:       {tendre:/amitié|famille|tendre|chaleur|enfance|rencontre/, absurde:/absurde|loufoque|déjanté|délirant|improbable|parodi/,
                 romantique:/amour|amoureu|rencontre|mariage|couple|séduire/, grincant:/satir|cynique|cruel|noir|arnaque|escroc|corruption/},
    reflechir:  {societe:/société|politique|justice|classe|racisme|pauvreté|pouvoir|corruption|ouvrier|banlieue|système/, esprit:/mémoire|identité|esprit|folie|conscience|rêve|psych|souvenir/,
                 histoire:/histoire|guerre|siècle|époque|révolution|réel|véritable/, futur:/futur|avenir|robot|intelligence artificielle|dystop|clone|vaisseau|planète/},
    emotion:    {melo:/deuil|perte|maladie|tragédie|séparation|sacrifice|destin|douleur/, amour:/amour|amoureu|passion|liaison|couple|mariage|rencontre/,
                 famille:/famille|mère|père|frère|sœur|fils|fille|enfant|parents/, musique:/musique|chanteu|musicien|groupe|concert|danse|chanson|piano|orchestre|rock|jazz/},
    adrenaline: {action:/combat|explos|fusillade|commando|affrontement|mercenaire|arts martiaux/, poursuite:/poursui|traqu|fuite|cavale|course|échapp|chasse/,
                 braquage:/braquage|casse|cambriol|hold-up|coffre|banque|butin|voler|vol de|arnaque|escroc/, guerre:/guerre|soldat|bataille|front|armée|militaire|régiment/},
    surprise:   {twist:/secret|vérité|mystère|disparition|révél|énigme|enquête|manipul|machination/, etrange:/étrange|bizarre|rêve|surréal|inexplicable|réalité|absurde|mystérieu/,
                 vrai:/histoire vraie|inspiré de faits|faits réels|biograph|véritable|réel|authentique/, melange:/./},
    detente:    {feelgood:/amitié|joie|bonheur|chaleur|rencontre|rêve|complicité|espoir/, doudou:/famille|enfant|animal|chien|chat|conte|magie|noël/,
                 legere:/voyage|vacances|route|\bété\b|virée|road trip|aventure|périple/, popcorn:/aventure|mission|course|trésor|héros|sauver|monde/},
    evasion:    {sf:/espace|planète|futur|robot|vaisseau|galaxie|extraterrestre|temps/, fantastique:/magie|magique|dragon|sorci|royaume|conte|légende|fée/,
                 aventure:/aventure|expédition|voyage|trésor|quête|jungle|\bîle\b|explor/, anim:/./}
  };
  function synopsis(d) { return d && d.overview ? String(d.overview).toLowerCase() : ''; }
  function frScore(d, mood) {
    var r = REG_FR[mood], tx = synopsis(d);
    if (!r || !tx) return 0;
    r.yes.lastIndex = 0;
    var n = (tx.match(r.yes) || []).length;
    return r.no.test(tx) && n === 0 ? -1 : n;
  }
  function frSub(d, p) {
    var re = p.subKey && SUB_FR[p.mood] && SUB_FR[p.mood][p.subKey], tx = synopsis(d);
    return !!(re && tx && re.test(tx));
  }

  /* verdict d'un film pour un profil : {drop, bonus, sure} */
  function registre(d, p, rescued, m) {
    var r = p.mood && REG[p.mood];
    var names = kwNames(d);
    if (!r) return {drop: false, bonus: 0, sure: false};
    var fs = frScore(d, p.mood);
    if (!names.length && !synopsis(d)) return {drop: !!rescued, bonus: 0, sure: false};
    var yes = names.filter(function (n) { return r.yes.test(n); }).length + Math.max(0, Math.min(2, fs));
    var no = names.some(function (n) { return r.no.test(n); }) || fs < 0;
    if (HARD[p.mood] && names.some(function (n) { return HARD[p.mood].test(n); })) return {drop: true, bonus: 0, sure: false, subMiss: true};
    var sub = p.subKey && SUB_KW[p.mood] && SUB_KW[p.mood][p.subKey];
    var subHit = (sub ? names.some(function (n) { return sub.test(n); }) : false) || frSub(d, p);
    /* sous-choix exigeant : sa preuve compte AVANT le test d'exclusion */
    var must = p.subKey && SUB_MUST[p.mood] && SUB_MUST[p.mood][p.subKey];
    var subMiss = !!(must && sub && !subHit);
    if (must && subHit) yes += 2;
    /* affinage à intention précise : ses mots-clés comptent comme ceux d'un sous-choix exigeant */
    var mk = p.microKey && MICRO_KW[p.microKey];
    if (mk) {
      var mHit = names.some(function (n) { return mk.test(n); });
      if (mHit) { yes += 2; if (!sub) subHit = true; }
      else subMiss = true;
      must = true;
    }
    if (yes === 0 && (no || rescued)) return {drop: true, bonus: 0, sure: false, subMiss: subMiss};
    var bonus = yes === 0 ? -9 : Math.min(9, 3 + yes * 2);
    if (subHit) bonus += 6;
    if (subMiss) bonus -= 12;
    if (rescued) {
      /* rattrapé : il faut un faisceau d'indices ET qu'il colle au sous-choix précis.
         S'il ne porte aucun des genres demandés, on exige encore plus de preuves. */
      /* sous-choix exigeant confirmé par ses propres mots-clés : c'est la preuve la plus directe */
      var need = (must && subHit) || (m && m.__hasCore) ? 2 : 3;
      var subOk = !sub || String(sub) === '/./' || subHit;
      if (yes < need || !subOk) return {drop: true, bonus: 0, sure: false};
      bonus -= 3;   /* un film rattrapé reste un peu moins sûr qu'un film bien classé */
    }
    return {drop: false, bonus: bonus, sure: yes >= 2, subMiss: subMiss};
  }

  /* rattrapage : films classés dans un autre genre mais dont les mots-clés
     correspondent à l'humeur. Identifiants de mots-clés résolus une fois puis gardés. */
  var KW_IDS = {};
  try { KW_IDS = JSON.parse(localStorage.getItem('cinemood.kwids') || '{}'); } catch (e) {}
  function kwId(name) {
    if (KW_IDS[name] !== undefined) return Promise.resolve(KW_IDS[name]);
    return api('/search/keyword', {query: name}).then(function (r) {
      var hit = (r.results || []).filter(function (k) { return String(k.name).toLowerCase() === name; })[0];
      KW_IDS[name] = hit ? hit.id : null;
      try { localStorage.setItem('cinemood.kwids', JSON.stringify(KW_IDS)); } catch (e) {}
      return KW_IDS[name];
    }).catch(function () { return null; });
  }
  function rescuePool(p, round) {
    var r = p.mood && REG[p.mood];
    if (!r) return Promise.resolve([]);
    var names = (p.microKey && MICRO_RESCUE[p.microKey])
      || (p.subKey && SUB_RESCUE[p.mood] && SUB_RESCUE[p.mood][p.subKey]) || r.rescue;
    return Promise.all(names.map(kwId)).then(function (ids) {
      ids = ids.filter(function (x) { return x; });
      if (!ids.length) return [];
      var base = query(p, 1);
      delete base.with_genres;
      var first = 1 + round * 3;
      return Promise.all([first, first + 1, first + 2].map(function (n) {
        return api('/discover/movie', Object.assign({}, base, {with_keywords: ids.join('|'), page: n}))
          .catch(function () { return {results: []}; });
      })).then(function (rs) {
        var out = [];
        rs.forEach(function (x) { (x.results || []).forEach(function (m) { out.push(Object.assign({}, m, {__rescueMood: p.mood})); }); });
        return out;
      });
    });
  }
  /* éligibilité d'un film rattrapé : on lève les seules règles de GENRE,
     tout le reste (interdits, années, note, votes, langue) s'applique */
  /* rattrapage encadré par humeur :
     NEEDS_CORE : le film doit porter au moins un genre de la famille de l'humeur
     KEEP_LEAD  : son genre principal ne peut pas être un genre écarté par l'humeur
     KEEP_NEED  : le genre imposé par le sous-choix reste obligatoire */
  var RESCUE_NEEDS_CORE = {peur: 1, rire: 1, detente: 1, surprise: 1};
  var RESCUE_CORE_EXEMPT = {surprise: {vrai: 1}};
  var RESCUE_KEEP_LEAD = {detente: 1, rire: 1, emotion: 1};
  var RESCUE_KEEP_NEED = {reflechir: {futur: 1, histoire: 1}, evasion: {sf: 1, fantastique: 1, anim: 1}, adrenaline: {guerre: 1}, emotion: {musique: 1, amour: 1}};
  function eligibleRescued(m, p) {
    var gs = m.genre_ids || [];
    if (!gs.length) return false;
    m.__hasCore = p.genres.some(function (g) { return gs.indexOf(g) > -1; });
    var md = m.__rescueMood || p.mood;
    var sk = p.subKey;
    var exempt = RESCUE_CORE_EXEMPT[md] && RESCUE_CORE_EXEMPT[md][sk];
    /* genre principal : jamais un genre écarté (ex. un western pour un braquage) */
    if ((p.offLead || []).indexOf(gs[0]) > -1) return false;
    /* le film doit appartenir à la famille de l'humeur ou aux genres demandés */
    if (!exempt && !m.__hasCore && !(MOOD_RULES[md] && MOOD_RULES[md].core.some(function (g) { return gs.indexOf(g) > -1; }))) return false;
    /* le genre imposé par le sous-choix et au moins un genre de l'affinage restent exigés */
    if (!exempt && p.need && !p.need.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.micro && !p.micro.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if (p.lead && !exempt && p.lead.indexOf(gs[0]) === -1 && !p.genres.some(function (g) { return gs.slice(0, 2).indexOf(g) > -1; })) return false;
    if (p.without.some(function (g) { return gs.indexOf(g) > -1; })) return false;
    if ((p.forbid || []).some(function (g) { return gs.indexOf(g) > -1; })) return false;
    var y = parseInt((m.release_date || '').slice(0, 4), 10);
    if (y && (y < p.years[0] || y > p.years[1])) return false;
    if (typeof m.vote_average === 'number' && m.vote_average < p.note - 0.05) return false;
    if (typeof m.vote_count === 'number' && m.vote_count < p.votes[0]) return false;
    if (p.votes[1] && m.vote_count > p.votes[1]) return false;
    if (p.lang && p.lang.split('|').indexOf(m.original_language) === -1) return false;
    return true;
  }
  /* pour le calcul du score, un film rattrapé est traité comme s'il portait le genre demandé */
  function asIfIn(m, p) {
    if (!m.__rescued || !p.genres.length || m.__rescueMood !== p.mood) return m;
    var gs = (m.genre_ids || []).slice();
    if (!p.genres.some(function (g) { return gs.indexOf(g) > -1; })) gs.unshift(p.genres[0]);
    return Object.assign({}, m, {genre_ids: gs});
  }

  function ambiance(d, t) {
    var names = ((d && d.keywords && d.keywords.keywords) || []).map(function (k) { return String(k.name).toLowerCase(); });
    if (!names.length) return {v: 60, hits: [], blocked: false};
    var has = {};
    Object.keys(AMB).forEach(function (k) { has[k] = names.some(function (nm) { return AMB[k].re.test(nm); }); });
    var tot = 0, got = 0, hits = [], pen = 0;
    Object.keys(t.want).forEach(function (k) { tot += t.want[k]; if (has[k]) { got += t.want[k]; hits.push(AMB[k].fr); } });
    Object.keys(t.avoid).forEach(function (k) { if (has[k]) pen += t.avoid[k]; });
    var v = tot ? 45 + 55 * Math.min(1, got / Math.min(tot, 2.2)) : 65;
    return {v: Math.round(clamp(v - pen * 22, 0, 100)), hits: hits.slice(0, 3), blocked: !!(t.block && has.dur)};
  }

  /* ===================== MODE DUO =====================
     Deux profils, un seul film. Principes :
     1. veto : ce qu'une personne exclut est exclu pour les deux ;
     2. temps commun : la durée retenue est celle que les deux ont ;
     3. vivier triple : goûts de la 1re personne, goûts de la 2e, ET leur
        croisement (films qui mêlent un genre de chacun) ;
     4. chaque film est noté contre CHAQUE profil, puis on agrège de façon
        équitable : un film adoré par l'un et subi par l'autre ne gagne pas. */
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function mergeProfiles(a, b) {
    var m = JSON.parse(JSON.stringify(a)), conflicts = [];
    /* Seuls les refus EXPLICITES s'additionnent. Les interdits liés à l'humeur
       (« avoir peur » exclut la comédie) ne doivent pas annuler l'envie de l'autre
       (« rire ») : ils sont arbitrés plus bas avec les genres-socle des deux. */
    var vetoes = uniq((a.veto || a.without).concat(b.veto || b.without));
    m.without = vetoes.slice();
    var ok = function (g) { return m.without.indexOf(g) === -1; };
    var lost = uniq(a.genres.concat(b.genres)).filter(function (g) { return !ok(g); });
    if (lost.length) conflicts.push(lost.map(function (g) { return GENRE_FR[g]; }).join(', ') + ' écarté par le veto de l\u2019un de vous');
    m.genres = uniq(a.genres.concat(b.genres)).filter(ok);
    m.pair = null;
    /* caps des deux humeurs : interdit si l'un l'interdit et que l'autre ne le demande pas ;
       un genre ne peut pas mener le film seulement si LES DEUX l'écartent */
    var cores = uniq((a.core || []).concat(b.core || []));
    m.core = cores;
    /* un interdit n'est levé que si l'autre personne demande VRAIMENT ce genre
       (ses genres retenus), pas seulement parce qu'il appartient à la famille de son humeur */
    m.forbid = uniq((a.forbid || []).concat(b.forbid || [])).filter(function (g) {
      /* animation : il faut que les DEUX la demandent, c'est un public, pas un ton */
      if (g === G.animation) {
        return !((a.genres || []).indexOf(g) > -1 && (b.genres || []).indexOf(g) > -1);
      }
      return m.genres.indexOf(g) === -1;
    });
    m.offLead = inter(a.offLead || [], b.offLead || []).filter(function (g) { return m.genres.indexOf(g) === -1; });
    m.bonus = uniq((a.bonus || []).concat(b.bonus || [])).filter(ok);
    m.mood = a.mood && b.mood ? 'duo' : (a.mood || b.mood);
    /* les précisions individuelles ne s'imposent au duo que si les deux les partagent */
    m.need = a.need && b.need ? (inter(a.need, b.need).length ? inter(a.need, b.need) : null) : (a.need || b.need || null);
    if (a.need && b.need && !inter(a.need, b.need).length) m.need = null;
    if (a.need && !b.need && b.mood && a.mood !== b.mood) m.need = null;
    if (b.need && !a.need && a.mood && a.mood !== b.mood) m.need = null;
    m.lead = a.lead && b.lead && inter(a.lead, b.lead).length ? inter(a.lead, b.lead) : null;
    m.also = null;
    m.subBonus = uniq((a.subBonus || []).concat(b.subBonus || [])).filter(ok);
    m.micro = null;
    m.without = uniq(vetoes.concat(m.forbid, [G.doc, 10770])).filter(function (g) { return m.genres.indexOf(g) === -1 || vetoes.indexOf(g) > -1; });
    m.veto = vetoes;
    if (a.freeRuntime && b.freeRuntime) { m.freeRuntime = true; m.runtime = [MIN_LONG, 400]; m.ideal = 120; }
    else if (a.freeRuntime || b.freeRuntime) {
      var c = a.freeRuntime ? b : a;
      m.freeRuntime = false; m.runtime = c.runtime.slice(); m.ideal = c.ideal;
    } else {
      var lo = Math.max(a.runtime[0], b.runtime[0]), hi = Math.min(a.runtime[1], b.runtime[1]);
      m.freeRuntime = false;
      if (lo <= hi) { m.runtime = [lo, hi]; m.ideal = clamp(Math.round((a.ideal + b.ideal) / 2), lo, hi); }
      else {
        var court = a.runtime[1] <= b.runtime[1] ? a : b;
        m.runtime = court.runtime.slice(); m.ideal = court.ideal;
        conflicts.push('vos durées ne se recoupent pas, on garde la plus courte');
      }
    }
    if (a.set.years && b.set.years) {
      var y0 = Math.max(a.years[0], b.years[0]), y1 = Math.min(a.years[1], b.years[1]);
      if (y0 <= y1) m.years = [y0, y1];
      else {
        m.years = [Math.min(a.years[0], b.years[0]), Math.max(a.years[1], b.years[1])];
        conflicts.push('époques différentes, on couvre les deux');
      }
    } else if (b.set.years) m.years = b.years.slice();
    if (a.lang && b.lang) {
      var la = a.lang.split('|'), lb = b.lang.split('|');
      var li = la.filter(function (x) { return lb.indexOf(x) > -1; });
      if (li.length) m.lang = li.join('|');
      else { m.lang = uniq(la.concat(lb)).join('|'); conflicts.push('langues différentes, on accepte les deux'); }
    } else m.lang = a.lang || b.lang;
    m.note = Math.min(a.note, b.note);
    m.votes = [Math.min(a.votes[0], b.votes[0]), (a.votes[1] && b.votes[1]) ? Math.max(a.votes[1], b.votes[1]) : null];
    m.certif = !!(a.certif || b.certif);
    m.intensity = Math.round((a.intensity + b.intensity) / 2);
    m.set = Object.assign({}, a.set, b.set);
    return {m: m, conflicts: conflicts};
  }
  function sideOf(m, genres, pair, axe) {
    var s = JSON.parse(JSON.stringify(m));
    s.genres = genres; s.pair = pair; s.axe = axe || 'note';
    return s;
  }
  /* agrégation équitable : le plus faible des deux pèse plus que la moyenne,
     et un grand écart entre les deux est pénalisé */
  function fuse(sa, sb) {
    /* un écart de plus de 12 points entre les deux est nettement pénalisé :
       un film qui ne plaît qu'à l'un passe derrière un film qui fait le pont */
    return Math.min(sa, sb) * 0.6 + (sa + sb) / 2 * 0.4 - Math.max(0, Math.abs(sa - sb) - 12) * 0.8;
  }
  function dureeScore(rt, M) {
    if (!rt) return 55;
    if (rt < M.runtime[0] || rt > M.runtime[1]) {
      var marge = rt < M.runtime[0] ? M.runtime[0] - rt : rt - M.runtime[1];
      return clamp(24 - marge * 0.8, 2, 24);
    }
    return clamp(100 - Math.abs(rt - M.ideal) * 1.5, 50, 100);
  }
  function duoWhy(m, e, pa, pb, M) {
    var gs = m.genre_ids || [], bits = [];
    var hA = gs.filter(function (g) { return pa.genres.indexOf(g) > -1; });
    var hB = gs.filter(function (g) { return pb.genres.indexOf(g) > -1; });
    var shared = hA.filter(function (g) { return hB.indexOf(g) > -1; });
    var low = function (g) { return (GENRE_FR[g] || '').toLowerCase(); };
    if (shared.length) bits.push('c\u2019est ' + duGenre(shared[0]) + ', que vous vouliez tous les deux');
    else if (hA.length && hB.length) bits.push('il mêle ' + low(hA[0]) + ' (1re personne) et ' + low(hB[0]) + ' (2e personne)');
    else if (hA.length) bits.push('côté genre, il suit la 1re personne (' + low(hA[0]) + ')');
    else if (hB.length) bits.push('côté genre, il suit la 2e personne (' + low(hB[0]) + ')');
    var h = heatOf(gs), wa = INT_WANT[pa.intensity] || 2.7, wb = INT_WANT[pb.intensity] || 2.7;
    var bas = Math.min(wa, wb), haut = Math.max(wa, wb);
    if (Math.abs(h - wa) < 0.8 && Math.abs(h - wb) < 0.8) bits.push('une intensité qui convient aux deux');
    else if (h >= bas - 0.3 && h <= haut + 0.3) bits.push('une intensité à mi-chemin entre vos deux envies');
    else bits.push(h > haut ? 'un peu plus intense que vos deux envies' : 'un peu plus doux que vos deux envies');
    if (e.runtime) bits.push(fmt(e.runtime) + (M.freeRuntime ? '' : ', dans le temps que vous avez tous les deux'));
    if (e.ambiance && e.ambiance.hits.length) bits.push('ambiance ' + e.ambiance.hits.join(', '));
    bits.push('noté ' + m.vote_average.toFixed(1) + '/10 sur ' + m.vote_count.toLocaleString('fr-FR') + ' votes');
    if (bits.length) bits[0] = bits[0].charAt(0).toUpperCase() + bits[0].slice(1);
    if (e.tier > 0) return 'Le meilleur terrain d\u2019entente : il respecte ' + e.covA + ' réponses sur 8 de la 1re personne et '
      + e.covB + ' sur 8 de la 2e. ' + bits.join(' · ') + '.';
    return 'Il tient pour vous deux : ' + e.duoA + ' % pour la 1re personne, ' + e.duoB + ' % pour la 2e. '
      + bits.join(' · ') + '.';
  }

  function recommendDuo(pathA, pathB, count, exclude, round, asked, carry) {
    round = round || 0;
    if (asked === undefined) asked = round;
    var n = count || 5;
    var pa = profile(pathA), pb = profile(pathB);
    var mg = mergeProfiles(pa, pb), strictM = mg.m, M = widen(strictM, round);
    var tA = moodTargets(pa), tB = moodTargets(pb);
    var ok = function (g) { return M.without.indexOf(g) === -1; };
    var wideGenres = M.genres.length > 0;
    var gA = wideGenres ? pa.genres.filter(ok) : [], gB = wideGenres ? pb.genres.filter(ok) : [];
    var pairOk = function (p) { return p && p.every(ok) ? p : null; };
    var inter = gA.filter(function (g) { return gB.indexOf(g) > -1; });
    var sides = [sideOf(M, gA, wideGenres ? pairOk(pa.pair) : null, pa.axe),
                 sideOf(M, gB, wideGenres ? pairOk(pb.pair) : null, pb.axe)];
    if (inter.length) sides.push(sideOf(M, inter, null, 'note'));
    else if (gA.length && gB.length) sides.push(sideOf(M, [gA[0], gB[0]], [gA[0], gB[0]], 'note'));
    var first = 1 + round * 3, reqs = [];
    sides.forEach(function (sp, i) {
      for (var k = 0; k < (i === 2 ? 4 : 3); k++) {
        reqs.push(api('/discover/movie', query(sp, first + k)).catch(function () { return {results: []}; }));
      }
    });
    var resA = rescuePool(Object.assign({}, M, {mood: pa.mood}), round).catch(function () { return []; });
    var resB = pb.mood !== pa.mood ? rescuePool(Object.assign({}, M, {mood: pb.mood}), round).catch(function () { return []; }) : Promise.resolve([]);
    return Promise.all([Promise.all(reqs), resA, resB]).then(function (all3) {
      var rs = all3[0], extra = all3[1].concat(all3[2]);
      var seen = {}, pool = [];
      rs.forEach(function (r) {
        (r.results || []).forEach(function (m) {
          if (!m.poster_path || seen[m.id]) return;
          if ((exclude || []).indexOf(m.id) > -1) return;
          if (!eligible(m, M)) return;   /* veto et contraintes communes : écarté */
          seen[m.id] = 1; pool.push(m);
        });
      });
      var nRes = 0;
      extra.forEach(function (m) {
        if (nRes >= 36 || !m.poster_path || seen[m.id]) return;
        if ((exclude || []).indexOf(m.id) > -1) return;
        if (!eligibleRescued(m, M)) return;
        seen[m.id] = 1; nRes++;
        var mm = Object.assign({}, m, {__rescued: true});
        eligibleRescued(mm, mm.__rescueMood === pa.mood ? pa : pb);
        pool.push(mm);
      });
      if (pool.length < n && round < 6) return recommendDuo(pathA, pathB, count, exclude, round + 1, asked, carry);
      var scored = pool.map(function (m) {
        var a = scoreOne(asIfIn(m, pa), pa), b = scoreOne(asIfIn(m, pb), pb);
        return {movie: m, ra: a.raw, rb: b.raw, ca: a.criteria, cb: b.criteria, raw: fuse(a.raw, b.raw)};
      }).sort(function (x, y) { return y.raw - x.raw || y.movie.vote_count - x.movie.vote_count; });
      var shortlist = scored.filter(function (e) { return !e.movie.__rescued; }).slice(0, n * 6)
        .concat(scored.filter(function (e) { return e.movie.__rescued; }).slice(0, n * 2));
      return Promise.all(shortlist.map(function (e) {
        return api('/movie/' + e.movie.id, {append_to_response: 'credits,keywords'}).catch(function () { return null; });
      })).then(function (details) {
        shortlist.forEach(function (e, i) {
          var d = details[i];
          e.details = d;
          e.runtime = d && d.runtime ? d.runtime : null;
          e.dureeTxt = e.runtime ? fmt(e.runtime) : '—';
          var dv = null;
          if (strictM.freeRuntime) {
            if (e.runtime && e.runtime < MIN_LONG) { e.ra *= 0.35; e.rb *= 0.35; }
          } else {
            dv = dureeScore(e.runtime, strictM);
            e.ra = e.ra * 0.76 + dv * 0.24; e.rb = e.rb * 0.76 + dv * 0.24;
          }
          var aA = ambiance(d, tA), aB = ambiance(d, tB);
          e.ambiance = {v: Math.round(Math.min(aA.v, aB.v) * 0.6 + (aA.v + aB.v) / 2 * 0.4),
            hits: uniq(aA.hits.concat(aB.hits)).slice(0, 3), blocked: aA.blocked || aB.blocked};
          e.ra = e.ra * 0.8 + aA.v * 0.2; e.rb = e.rb * 0.8 + aB.v * 0.2;
          /* deuxième avis pour chacun : un film ne doit contredire l'humeur d'aucun des deux.
             Un film rattrapé doit être confirmé pour au moins l'un des deux. */
          var gA = registre(d, pa, false), gB = registre(d, pb, false);
          /* un film rattrapé doit être pleinement confirmé pour l'humeur qui l'a fait venir */
          var side = e.movie.__rescueMood === pa.mood ? pa : pb;
          var conf = e.movie.__rescued ? registre(d, side, true, e.movie).drop : false;
          e.registre = {drop: gA.drop || gB.drop || conf, dropA: !!gA.drop, dropB: !!gB.drop, conf: !!conf,
            subMiss: !!(gA.subMiss && gB.subMiss),
            missA: !!gA.subMiss, missB: !!gB.subMiss};
          e.ra += gA.bonus; e.rb += gB.bonus;
          e.raw = fuse(e.ra, e.rb);
          e.duoA = Math.round(clamp(e.ra, 5, 99));
          e.duoB = Math.round(clamp(e.rb, 5, 99));
          e.global = Math.round(clamp(e.raw, 5, 99));
          e.criteria = e.ca.map(function (c, j) {
            return {k: c.k, l: c.l, v: Math.round(Math.min(c.v, e.cb[j].v) * 0.6 + (c.v + e.cb[j].v) / 2 * 0.4)};
          });
          if (dv !== null) e.criteria.push({k: 'duree', l: 'Durée', v: Math.round(dv)});
          e.criteria.push({k: 'ambiance', l: 'Ambiance', v: e.ambiance.v});
          e.realisateur = d && d.credits ? (d.credits.crew || []).filter(function (c) { return c.job === 'Director'; })[0] : null;
          e.genresTxt = d && d.genres ? d.genres.map(function (g) { return g.name; }).slice(0, 3).join(', ')
            : (e.movie.genre_ids || []).map(function (g) { return GENRE_FR[g]; }).filter(Boolean).slice(0, 3).join(', ');
        });
        /* PALIERS — chaque réponse compte.
           A : le film tient pour les deux (ton, envie précise, thème, aucune contradiction)
           B : il tient pour l'un et ne contredit pas l'humeur de l'autre (un vrai pont)
           C : il tient pour l'un seulement
           D : il ne tient pleinement pour personne, mais coche le plus de réponses
           Dans chaque palier, on classe par nombre de réponses respectées, en
           privilégiant l'équilibre : celui des deux qui est le moins servi compte double.
           Seul un contenu bloqué (ex. gore pour des enfants) reste éliminatoire. */
        shortlist = shortlist.filter(function (e) { return !e.ambiance.blocked && !e.registre.conf; });
        var animOk2 = wantsAnim(pa) && wantsAnim(pb);
        var K = 8;
        var couverture = function (e, p, drop) {
          var q = Object.assign({}, p, {forbid: M.forbid, veto: M.veto});
          var gs = exactGenres(e), mv = e.movie, y = parseInt((mv.release_date || '').slice(0, 4), 10);
          var c = {ton: coherentBase(e, q, animOk2), need: coherentNeed(e, p), kw: coherentKw(e, p), mood: !drop};
          c.ok = c.ton && c.need && c.kw && c.mood;
          var n2 = (c.ton ? 1 : 0) + (c.need ? 1 : 0) + (c.kw ? 1 : 0) + (c.mood ? 1 : 0);
          var want = INT_WANT[p.intensity] || 2.7;
          if (Math.abs(heatOf(gs) - want) < 0.9) n2++;
          if (p.freeRuntime || (e.runtime && e.runtime >= p.runtime[0] && e.runtime <= p.runtime[1])) n2++;
          if (!p.set.years || (y && y >= p.years[0] && y <= p.years[1])) n2++;
          if (mv.vote_count >= p.votes[0] && (!p.votes[1] || mv.vote_count <= p.votes[1])) n2++;
          c.n = n2;
          return c;
        };
        shortlist.forEach(function (e) {
          var cA = couverture(e, pa, e.registre.dropA), cB = couverture(e, pb, e.registre.dropB);
          e.covA = cA.n; e.covB = cB.n;
          e.tier = cA.ok && cB.ok ? 0
            : (cA.ok && cB.mood) || (cB.ok && cA.mood) ? 1
            : cA.ok || cB.ok ? 2 : 3;
          e.cover = Math.min(cA.n, cB.n) * 2 + cA.n + cB.n;
          e.pref = 0;
        });
        var seenD = {};
        shortlist = (carry || []).concat(shortlist).filter(function (e) {
          if (seenD[e.movie.id]) return false; seenD[e.movie.id] = 1; return true;
        });
        var nA0 = shortlist.filter(function (e) { return e.tier === 0; }).length;
        /* trop peu de films qui conviennent aux deux : on élargit une fois ou deux
           en gardant ceux déjà trouvés, avant de recourir aux paliers suivants */
        if (nA0 < n && round < 2) return recommendDuo(pathA, pathB, count, exclude, round + 1, asked,
          shortlist.filter(function (e) { return e.tier === 0; }));
        if (!shortlist.length) {
          return Promise.all([recommend(pathA, 3, exclude, 0), recommend(pathB, 3, exclude, 0)]).then(function (two) {
            var seen = {}, mix = [];
            [0, 1, 2].forEach(function (i) {
              [two[0].results[i], two[1].results[i]].forEach(function (e) {
                if (e && !seen[e.movie.id] && mix.length < n) { seen[e.movie.id] = 1; mix.push(e); }
              });
            });
            mix.forEach(function (e, i) { e.rank = i; delete e.duoA; delete e.duoB; });
            return {results: mix, chips: (two[0].chips || []).concat(two[1].chips || []), total: mix.length, round: round,
              autoWidened: true,
              relaxMessage: 'Vos deux envies sont trop opposées pour qu\u2019un même film les réunisse vraiment. Voici, en alternance, le meilleur pour chacun de vous.'};
          });
        }
        /* préférences (plus jamais des filtres : une liste ne doit pas tomber à 2 films) */
        var hit = function (e, gs) { var x = e.movie.genre_ids || []; return (gs || []).some(function (g) { return x.indexOf(g) > -1; }); };
        var dA = (pa.genres || []).filter(function (g) { return (pb.genres || []).indexOf(g) === -1; });
        var dB = (pb.genres || []).filter(function (g) { return (pa.genres || []).indexOf(g) === -1; });
        var nA = dA.length ? dA : pa.genres, nB = dB.length ? dB : pb.genres;
        shortlist.forEach(function (e) {
          if (!e.registre.subMiss) e.pref += 1;
          if (!e.registre.missA && !e.registre.missB) e.pref += 1;
          /* le film idéal à deux contient un genre demandé par CHACUN */
          if (hit(e, nA) && hit(e, nB)) e.pref += 2;
          else if (hit(e, nA) || hit(e, nB)) e.pref += 0.5;
        });
        var nr2 = 0, mA = SUB_MUST[pa.mood] && SUB_MUST[pa.mood][pa.subKey], mB = SUB_MUST[pb.mood] && SUB_MUST[pb.mood][pb.subKey];
        var capR2 = (mA || mB) ? n : 2;
        shortlist = shortlist.filter(function (e) { if (!e.movie.__rescued) return true; nr2++; return nr2 <= capR2; });
        shortlist = shortlist.filter(function (e) { return !(e.runtime && e.runtime < MIN_LONG); });
        shortlist.forEach(function (e) {
          if (strictM.freeRuntime || (e.runtime && e.runtime >= strictM.runtime[0] && e.runtime <= strictM.runtime[1])) e.pref += 1;
        });
        shortlist.sort(function (x, y) {
          return x.tier - y.tier || (y.cover + y.pref) - (x.cover + x.pref) || y.raw - x.raw || y.movie.vote_count - x.movie.vote_count;
        });
        var top = diversify(shortlist, n);
        top = top.slice(0, 1).concat(top.slice(1).sort(function (x, y) { return x.tier - y.tier || y.raw - x.raw; }));
        var pont = top.some(function (e) { return e.tier > 0; });
        var vus = [];
        top.forEach(function (e, i) {
          e.rank = i;
          if (i === 0) e.profil = 'Le meilleur compromis';
          else { e.profil = profilOf(e, top[0], vus); vus.push(e.profil); }
          e.why = duoWhy(e.movie, e, pa, pb, strictM);
        });
        var auto = round > asked;
        return {
          results: top, total: pool.length, conflicts: mg.conflicts,
          chips: ['Duo · 2 profils fusionnés'].concat(filterChips(auto ? strictM : M)),
          round: asked, autoWidened: auto || pont,
          relaxMessage: pont
            ? 'Vos envies sont différentes : voici les films qui réunissent le plus de réponses de vous deux.'
            : auto ? fallbackMessage(round) : relaxMessage(round)
        };
      });
    });
  }

  /* ---------- rayons du catalogue ----------
     Chaque rayon = une requête TMDB + un contrôle côté site (keep).
     TMDB rattache un film à plusieurs genres et ses filtres « ou » sont larges :
     on vérifie donc que le genre du rayon est bien l'un des DEUX genres
     principaux du film, et qu'aucun genre contradictoire n'est présent.
     Ensuite le site attribue chaque film à UN SEUL rayon (ordre de priorité). */
  function iso(d) { return d.toISOString().slice(0, 10); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return iso(d); }
  function main(m, ids) { var g = (m.genre_ids || []).slice(0, 2); return ids.some(function (i) { return g.indexOf(i) > -1; }); }
  function has(m, ids) { var g = m.genre_ids || []; return ids.some(function (i) { return g.indexOf(i) > -1; }); }
  var NO_DOC = '99,10770';

  var SHELVES = [
    {id:'now', l:'Sorties récentes', prio:0,
      crit:'sortis en France ces 4 derniers mois · actualisé chaque jour',
      q:function () { return {region:'FR', 'release_date.gte':daysAgo(120), 'release_date.lte':daysAgo(0),
        with_release_type:'2|3|4', 'vote_count.gte':25, without_genres:NO_DOC, sort_by:'popularity.desc'}; },
      keep:function (m) { return !m.release_date || m.release_date <= daysAgo(-7); }},
    {id:'top', l:'Les mieux notés de tous les temps', prio:10,
      crit:'note ≥ 8 · 5 000+ votes',
      q:{'vote_count.gte':5000, 'vote_average.gte':8, without_genres:NO_DOC, sort_by:'vote_average.desc'}},
    {id:'rire', l:'Ça fait rire', prio:2,
      crit:'comédie en genre principal · note ≥ 7 · 1 500+ votes',
      q:{with_genres:'35', without_genres:'27,53,10752,36,' + NO_DOC, 'vote_average.gte':7, 'vote_count.gte':1500, sort_by:'vote_average.desc'},
      keep:function (m) { return main(m, [35]) && !has(m, [27, 53, 10752, 80]); }},
    {id:'peur', l:'Ça fait peur', prio:1,
      crit:'horreur en genre principal · note ≥ 6.8 · 1 500+ votes',
      q:{with_genres:'27', without_genres:'35,10751,16,10402,10749,' + NO_DOC, 'vote_average.gte':6.8, 'vote_count.gte':1500, sort_by:'vote_average.desc'},
      keep:function (m) { return main(m, [27]) && !has(m, [35, 10751, 16, 10402, 10749]); }},
    {id:'cerveau', l:'Ça fait réfléchir', prio:4,
      crit:'mystère ou science-fiction de fond · note ≥ 7.6 · 2 000+ votes',
      q:{with_genres:'9648|878', without_genres:'35,16,10751,27,' + NO_DOC, 'vote_average.gte':7.6, 'vote_count.gte':2000, sort_by:'vote_average.desc'},
      keep:function (m) { return (main(m, [9648]) || (has(m, [878]) && has(m, [18, 9648, 53]))) && !has(m, [35, 16, 10751, 27]); }},
    {id:'spectacle', l:'Grand spectacle', prio:5,
      crit:'action / aventure en genre principal · note ≥ 7.3 · 4 000+ votes',
      q:{with_genres:'28|12', without_genres:'16,10751,27,10749,' + NO_DOC, 'vote_average.gte':7.3, 'vote_count.gte':4000, sort_by:'vote_average.desc'},
      keep:function (m) { return main(m, [28, 12]) && !has(m, [16, 10751, 27, 10749]); }},
    {id:'famille', l:'Toute la famille', prio:3,
      crit:'famille / animation · sans horreur ni violence · note ≥ 7.3',
      q:{with_genres:'10751|16', without_genres:'27,53,80,10752,' + NO_DOC, 'vote_average.gte':7.3, 'vote_count.gte':2000, sort_by:'vote_average.desc'},
      keep:function (m) { return main(m, [10751, 16]) && !has(m, [27, 53, 80, 10752]); }},
    {id:'court', l:'Moins de 1h40', prio:9,
      crit:'entre 60 et 100 min · note ≥ 7.5 · 1 000+ votes',
      q:{'with_runtime.gte':60, 'with_runtime.lte':100, without_genres:NO_DOC, 'vote_average.gte':7.5, 'vote_count.gte':1000, sort_by:'vote_average.desc'}},
    {id:'fr', l:'Cinéma français', prio:6,
      crit:'langue originale française · note ≥ 7.2 · 800+ votes',
      q:{with_original_language:'fr', without_genres:NO_DOC, 'vote_average.gte':7.2, 'vote_count.gte':800, sort_by:'vote_average.desc'},
      keep:function (m) { return m.original_language === 'fr'; }},
    {id:'monde', l:'Cinéma du monde', prio:7,
      crit:'coréen / japonais / espagnol / italien · note ≥ 7.5',
      q:{with_original_language:'ko|ja|es|it', without_genres:'16,' + NO_DOC, 'vote_average.gte':7.5, 'vote_count.gte':800, sort_by:'vote_average.desc'},
      keep:function (m) { return ['ko', 'ja', 'es', 'it'].indexOf(m.original_language) > -1; }},
    {id:'pepites', l:'Pépites peu vues', prio:8,
      crit:'note ≥ 7.5 · seulement 250 à 1 200 votes',
      q:{without_genres:NO_DOC, 'vote_average.gte':7.5, 'vote_count.gte':250, 'vote_count.lte':1200, sort_by:'vote_average.desc'}}
  ];

  /* deux pages par rayon : assez de matière pour garder 12 films après tri et dédoublonnage */
  function shelf(def, page) {
    var q = typeof def.q === 'function' ? def.q() : def.q;
    var pages = page ? [page] : [1, 2];
    return Promise.all(pages.map(function (p) {
      return api('/discover/movie', Object.assign({page: p}, q)).catch(function () { return {results: []}; });
    })).then(function (rs) {
      var seen = {}, out = [];
      rs.forEach(function (r) {
        (r.results || []).forEach(function (m) {
          if (seen[m.id] || !m.poster_path) return;
          if (def.keep && !def.keep(m)) return;
          seen[m.id] = 1; out.push(m);
        });
      });
      return {results: out};
    });
  }

  /* chaque film n'apparaît que dans un rayon : celui de plus haute priorité */
  function dedupeShelves(list, per) {
    var owner = {};
    list.slice().sort(function (a, b) { return a.def.prio - b.def.prio; }).forEach(function (sh) {
      sh.films.forEach(function (m) { if (!(m.id in owner)) owner[m.id] = sh.def.id; });
    });
    return list.map(function (sh) {
      return {def: sh.def, failed: sh.failed,
        films: sh.films.filter(function (m) { return owner[m.id] === sh.def.id; }).slice(0, per || 12)};
    });
  }
  function search(q, page) { return api('/search/movie', {query: q, page: page || 1}); }
  function movie(id) { return api('/movie/' + id, {append_to_response: 'credits'}); }

  /* fiche complète : synopsis, bande-annonce, distribution */
  function full(id) {
    return api('/movie/' + id, {append_to_response: 'videos,credits', include_video_language: 'fr,en,null'})
      .then(function (d) {
        var vids = (d.videos && d.videos.results) || [];
        var yt = vids.filter(function (v) { return v.site === 'YouTube'; });
        var pick = yt.filter(function (v) { return v.type === 'Trailer' && v.iso_639_1 === 'fr'; })[0]
          || yt.filter(function (v) { return v.type === 'Trailer'; })[0]
          || yt.filter(function (v) { return v.type === 'Teaser'; })[0] || yt[0];
        var crew = (d.credits && d.credits.crew) || [];
        d.trailer = pick ? {key: pick.key, name: pick.name} : null;
        d.director = crew.filter(function (c) { return c.job === 'Director'; })[0] || null;
        d.writers = crew.filter(function (c) { return c.job === 'Screenplay' || c.job === 'Writer'; }).slice(0, 2);
        d.cast = ((d.credits && d.credits.cast) || []).slice(0, 10);
        return d;
      });
  }

  return {setKey: setKey, key: key, setRunToken: setRunToken,
    usingProxy: function () { return mode === 'proxy'; },
    poster: poster, GENRE_FR: GENRE_FR, TOTAL: TOTAL, questionAt: questionAt,
    profile: profile, filterChips: filterChips, recommend: recommend, recommendDuo: recommendDuo, relaxMessage: relaxMessage,
    SHELVES: SHELVES, shelf: shelf, dedupeShelves: dedupeShelves, search: search, movie: movie, full: full, fmt: fmt};
})();

/* CinéMood — version anglaise.
   Le site est écrit en français ; en mode anglais, ce module traduit à la volée
   tout texte affiché (y compris ce qui apparaît plus tard), et le catalogue TMDB
   est interrogé en anglais (titres, synopsis, bandes-annonces).
   Choix mémorisé dans le navigateur. Sans choix enregistré : anglais si le
   navigateur n'est pas en français. Les pages légales restent en français. */
window.MoodflixI18n = (function () {
  'use strict';
  var KEY = 'cinemood.lang';
  var lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) {}
  if (lang !== 'fr' && lang !== 'en') {
    var nav = (navigator.language || 'fr').toLowerCase();
    lang = nav.indexOf('fr') === 0 ? 'fr' : 'en';
  }
  var api = {lang: lang, toggle: null, t: function (s) { return s; }};

  var norm = function (s) { return s.replace(/\u2019/g, "'").replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim(); };

  var RAW = [
/* interface */
'Trouver mon film=>Find my film', 'Trouver=>Find', 'Commencer=>Start', 'Mode Duo=>Duo mode', 'Comment ça marche=>How it works',
'Accueil=>Home', 'Le principe=>How it works', 'Catégories=>Categories', 'Rechercher un film=>Search for a film',
'Ton humeur choisit ton=>Your mood picks your',
'Heureux, triste, amoureux, crevé ? Dis-nous comment tu te sens : en une minute, on te trouve les films faits pour ce moment-là.=>Happy, sad, in love, worn out? Tell us how you feel: in one minute, we find the films made for that moment.',
'questions · une minute=>questions · one minute',
'Un conseiller cinéma,=>A film advisor,', 'pas un catalogue de plus=>not just another catalogue',
'Tu passes trente minutes à chercher quoi regarder.=>You spend thirty minutes looking for something to watch.',
'On part de ton moment et on répond en une minute.=>We start from your moment and answer in one minute.',
'Tu dis comment tu te sens=>You say how you feel',
'Chaque film est vérifié deux fois=>Every film is checked twice',
'Par ses genres, puis par ses mots-clés. Ce qui ne colle pas à ton envie est écarté, même s\'il est populaire. En mode Duo, le film doit convenir à vous deux.=>By its genres, then by its keywords. Anything that doesn\'t fit what you want is ruled out, even if it\'s popular. In Duo mode, the film has to suit you both.',
'Ton meilleur choix, et 4 autres=>Your best pick, and 4 more',
'Le film qui te correspond le mieux, puis quatre alternatives, chacune avec la raison de sa place. Aucun ne te tente ? Un clic, et quatre nouveaux arrivent.=>The film that suits you best, then four alternatives, each with the reason it made the list. None of them tempting? One click and four new ones arrive.',
'Le catalogue=>The catalogue', 'par catégories=>by category', 'Chaque rangée est une requête exacte.=>Each row is an exact query.',
'Le critère est écrit sous le titre : rien n\'est choisi à la main.=>The criteria are written under the title: nothing is hand-picked.',
'Le catalogue ne répond pas pour le moment. Vérifie ta connexion — les films reviennent dès que le service est joignable.=>The catalogue isn\'t responding right now. Check your connection — the films come back as soon as the service is reachable.',
'Réessayer=>Try again',
'Ce produit utilise l\'API TMDB mais n\'est ni approuvé ni certifié par TMDB. Données et affiches fournies par The Movie Database.=>This product uses the TMDB API but is not endorsed or certified by TMDB. Data and posters provided by The Movie Database.',
'Site conçu avec le=>Site made with', 'par un passionné de cinéma=>by a film lover',
'Mentions légales=>Legal notice', 'Conditions générales=>Terms', 'Confidentialité=>Privacy',
'Ce soir au programme=>Tonight\'s programme', 'Le film qui colle à ton moment=>The film that fits your moment',
'Ta séance=>Your screening', 'Tes films du moment=>Your films for tonight', 'Refaire=>Start over',
'Pourquoi lui=>Why this one', 'Voir la fiche=>See details', 'Où le voir=>Where to watch', 'Pas lui=>Not this one',
'Aucun ne me tente=>None of these', 'Encore d\'autres=>Show me more', 'Ajuste un critère et relance.=>Adjust one answer and try again.',
'Quitter ✕=>Exit ✕', 'Ticket N°=>Ticket No.', 'Touches 1–=>Keys 1–', 'pour répondre · ← pour revenir=>to answer · ← to go back',
'Mode Duo · étape 2=>Duo mode · step 2', 'Passe l\'écran=>Hand the screen', 'à l\'autre personne=>to the other person',
'Le premier profil est enregistré. À son tour de répondre, sans voir tes réponses — on ne gardera que les films qui tiennent pour vous deux.=>The first profile is saved. Now it\'s their turn to answer, without seeing yours — we\'ll only keep the films that work for both of you.',
'C\'est à moi=>My turn', '1re personne=>1st person', '2e personne=>2nd person',
'Synopsis=>Synopsis', 'Fiche TMDB=>TMDB page', 'Bande-annonce=>Trailer', 'Le lecteur ne démarre pas ?=>Player won\'t start?',
'Ouvrir sur YouTube=>Open on YouTube', 'Aucune bande-annonce disponible pour ce titre.=>No trailer available for this title.',
'Distribution=>Cast', 'Distribution non renseignée.=>Cast not available.',
'Pas de synopsis en français pour ce titre.=>No synopsis available for this title.',
'Aucun synopsis en français n\'est disponible pour ce titre.=>No synopsis available for this title.',
'Chercher un film…=>Search for a film…', 'Fermer la recherche=>Close search', 'Fermer la fiche=>Close', 'Fermer=>Close',
'Films précédents=>Previous films', 'Films suivants=>Next films',
'Tape au moins deux lettres — tout le catalogue est interrogeable.=>Type at least two letters — the whole catalogue is searchable.',
'Aucun film trouvé.=>No film found.',
'Lecture de tes réponses=>Reading your answers', 'Construction des filtres=>Building the filters',
'Analyse des candidats=>Analysing candidates', 'Classement final=>Final ranking',
'Une erreur est survenue. Réessaie.=>Something went wrong. Please try again.', 'Réessaie dans un instant.=>Try again in a moment.',
'Même en ouvrant tous les critères, le catalogue ne rend plus rien de neuf sur ce chemin. Reprends le parcours en changeant une réponse.=>Even with every criterion opened up, the catalogue has nothing new left on this path. Start again and change one answer.',
'Aucun film ne tient dans vos deux profils, même en élargissant. Reprenez le parcours en assouplissant une réponse.=>No film fits both your profiles, even after widening. Start again and loosen one answer.',
/* badges et messages du moteur */
'Pas trop long=>Not too long', 'moins de 1h45=>under 1h45', 'Une soirée classique=>A regular evening', 'environ 1h30 à 2h15=>about 1h30 to 2h15', 'Toute la soirée=>The whole evening', '2h et plus, ça me va=>2h or more is fine', 'Plutôt récent ou plutôt ancien ?=>Recent or older?', 'Récent=>Recent', '2010 et après=>2010 and later', 'Années 80 à 2000=>80s to 2000s', 'les classiques modernes=>modern classics', 'Ancien=>Older', 'avant 1980=>before 1980', 'Un film connu, ou une découverte ?=>A well-known film, or a discovery?', 'Un film connu=>A well-known film', 'peu de risque=>low risk', 'Une découverte=>A discovery', 'moins vu, mais bien noté=>less seen, but well rated', 'Le meilleur choix=>The best pick', 'La valeur sûre=>The safe bet', 'La pépite cachée=>The hidden gem', '↻ Rafraîchir la liste=>↻ Refresh the list', 'Je sais pas=>Not sure', 'Plus drôle=>Funnier', 'Plus intense=>More intense', 'Plus doux=>Gentler', 'Plus court=>Shorter',
'Plus ample=>More epic', 'Plus grand public=>More mainstream', 'Plus confidentiel=>Lesser known', 'Mieux noté=>Better rated',
'Plus récent=>More recent', 'Plus ancien=>Older', 'Autre angle=>Another angle', 'Le meilleur compromis=>The best compromise',
'Duo · 2 profils fusionnés=>Duo · 2 profiles merged',
'Je garde ton cap et j\'ouvre sur la notoriété.=>I\'m keeping your direction and widening on how well-known the film is.',
'J\'élargis les années de sortie — ton registre ne bouge pas.=>I\'m widening the release years — your mood stays the same.',
'J\'ouvre aussi la durée, toujours dans le même genre.=>I\'m also widening the length, still in the same genre.',
'J\'ouvre à toutes les langues pour continuer à te proposer autre chose.=>I\'m opening up to every language to keep finding something new.',
'Je décroise les genres : ton mood reste le même, les profils changent.=>I\'m loosening the genre blend: your mood stays the same, the profiles change.',
'On est au bout du filon : voici ce qui reste de plus proche de tes réponses.=>We\'ve reached the end of the line: here\'s what\'s still closest to your answers.',
'Aucun film ne correspond vraiment à ce mélange de réponses. Change une réponse (le public ou le sous-choix) et relance.=>No film really matches this mix of answers. Change one answer (who you\'re watching with, or the finer choice) and try again.',
'Aucun film ne réunit exactement vos deux nuances. Voici les plus proches de vos deux envies principales.=>No film brings both your nuances together exactly. Here are the closest to your two main moods.',
'Vos deux envies sont trop opposées pour qu\'un même film les réunisse vraiment. Voici, en alternance, le meilleur pour chacun de vous.=>Your two moods are too far apart for one film to really unite them. Here, in turns, is the best for each of you.',
'Vos envies sont différentes : voici les films qui réunissent le plus de réponses de vous deux.=>Your moods are different: here are the films that match the most of both your answers.', 'une intensité qui convient aux deux=>an intensity that suits you both', 'une intensité à mi-chemin entre vos deux envies=>an intensity halfway between your two wishes',
'un peu plus intense que vos deux envies=>a little more intense than you both wanted', 'un peu plus doux que vos deux envies=>a little gentler than you both wanted',
'un cran au-dessus de l\'intensité demandée=>a notch above the intensity you asked for', 'un cran en dessous de l\'intensité demandée=>a notch below the intensity you asked for',
/* rayons */
'Sorties récentes=>New releases', 'sortis en France ces 4 derniers mois · actualisé chaque jour=>released in France over the last 4 months · updated daily',
'Les mieux notés de tous les temps=>Highest rated of all time', 'Ça fait rire=>Makes you laugh',
'comédie en genre principal · note ≥ 7 · 1 500+ votes=>comedy as main genre · rating ≥ 7 · 1,500+ votes',
'Ça fait peur=>Scary', 'horreur en genre principal · note ≥ 6.8 · 1 500+ votes=>horror as main genre · rating ≥ 6.8 · 1,500+ votes',
'Ça fait réfléchir=>Makes you think', 'mystère ou science-fiction de fond · note ≥ 7.6 · 2 000+ votes=>mystery or deep science fiction · rating ≥ 7.6 · 2,000+ votes',
'Grand spectacle=>Big spectacle', 'action / aventure en genre principal · note ≥ 7.3 · 4 000+ votes=>action / adventure as main genre · rating ≥ 7.3 · 4,000+ votes',
'Toute la famille=>The whole family', 'famille / animation · sans horreur ni violence · note ≥ 7.3=>family / animation · no horror or violence · rating ≥ 7.3',
'Moins de 1h40=>Under 1h40', 'langue originale française · note ≥ 7.2 · 800+ votes=>original French language · rating ≥ 7.2 · 800+ votes',
'Cinéma du monde=>World cinema', 'Pépites peu vues=>Hidden gems', 'Cinéma français=>French cinema',
/* questions : humeur */
'Ton humeur=>Your mood', 'Comment tu te sens ce soir ?=>How are you feeling tonight?',
'Heureux=>Happy', 'la journée a été bonne=>it\'s been a good day', 'Tu veux prolonger ça comment ?=>How do you want to keep it going?',
'Avec un vrai fou rire=>With a real belly laugh', 'n\'importe quoi, et c\'est bien=>total nonsense, and that\'s fine',
'Avec une comédie qui réchauffe=>With a heartwarming comedy', 'tendre et sans méchanceté=>tender, never mean',
'Avec un film qui fait du bien=>With a feel-good film', 'on en ressort encore mieux=>you come out feeling even better',
'En partant à l\'aventure=>By heading off on an adventure', 'grands espaces, expéditions=>wide open spaces, expeditions',
'Amoureux=>In love', 'le cœur qui bat=>heart racing', 'Quelle histoire d\'amour te tente ?=>What kind of love story tempts you?',
'Une grande histoire d\'amour=>A great love story', 'regards et silences=>glances and silences', 'Une comédie romantique=>A romantic comedy',
'ça finit bien=>it ends well', 'Un amour qui fait pleurer=>A love that makes you cry', 'prévois les mouchoirs=>bring tissues',
'Un amour impossible=>An impossible love', 'ça ne peut pas marcher=>it can\'t work out', 'Un amour qui finit mal=>A love that ends badly',
'deux êtres, puis plus rien=>two people, then nothing', 'Un amour d\'un autre temps=>A love from another time', 'costumes et lettres=>costumes and letters',
'Quel amour va te briser le cœur ?=>Which love will break your heart?',
'Triste=>Sad', 'un coup de mou=>feeling low', 'Qu\'est-ce qui te ferait du bien ?=>What would do you good?',
'Être réconforté=>Being comforted', 'un film comme un plaid=>a film like a warm blanket', 'Qu\'on me remonte le moral=>Cheering up',
'on repart avec le sourire=>you leave with a smile', 'Pleurer un bon coup=>A good cry', 'ça libère=>it lets it out',
'Me sentir entouré=>Feeling surrounded', 'des liens qui tiennent bon=>bonds that hold strong',
'Fatigué=>Tired', 'je veux juste me poser=>I just want to switch off', 'Tu veux te reposer comment ?=>How do you want to rest?',
'Un grand spectacle=>A big spectacle', 'cerveau en pause=>brain on pause', 'Une petite aventure=>A small adventure', 'sans prise de tête=>no headache',
'Rire sans effort=>Effortless laughs', 'une comédie douce=>a gentle comedy', 'Un dessin animé=>A cartoon', 'pour tous les âges=>for all ages',
'Énervé=>Angry', 'il faut que ça sorte=>it has to come out', 'Tu veux évacuer ça comment ?=>How do you want to let it out?',
'Que ça explose=>Explosions', 'bagarres et cascades=>fights and stunts', 'Une course sans répit=>A relentless chase', 'ça ne s\'arrête jamais=>it never stops',
'Une grande bataille=>A great battle', 'la guerre en grand=>war on a grand scale', 'En riant de tout=>Laughing at everything', 'un humour noir, qui pique=>dark, biting humour',
'Téméraire=>Daring', 'prêt à frissonner=>ready to shiver', 'Qu\'est-ce qui te fait le plus peur ?=>What scares you the most?',
'Sursauter=>Jump scares', 'de la vraie horreur=>real horror', 'Ce qu\'on ne peut pas expliquer=>What can\'t be explained',
'fantômes, démons, malédictions=>ghosts, demons, curses', 'Qu\'on joue avec mes nerfs=>Being toyed with', 'une tension qui monte=>tension that builds',
'une tension qui monte lentement=>tension that builds slowly', 'Être traqué, piégé=>Being hunted, trapped', 'survivre coûte que coûte=>survive at any cost',
'Blasé=>Jaded', 'rien ne m\'étonne=>nothing surprises me', 'Qu\'est-ce qui pourrait te réveiller ?=>What could wake you up?',
'Une fin que je n\'ai pas vue venir=>An ending I didn\'t see coming', 'tout bascule=>everything flips', 'Un casse bien ficelé=>A well-planned heist',
'un plan, une équipe=>a plan, a crew', 'Quelque chose de vraiment bizarre=>Something truly bizarre', 'hors de toute norme=>beyond all norms',
'Un film qui change de ton=>A film that changes tone', 'on rit, puis plus du tout=>you laugh, then not at all',
'Curieux=>Curious', 'envie d\'apprendre=>eager to learn', 'Tu es curieux de quoi ?=>What are you curious about?',
'D\'une histoire vraie incroyable=>An incredible true story', 'et pourtant, c\'est arrivé=>and yet, it happened', 'De l\'Histoire=>History',
'ce qui s\'est vraiment passé=>what really happened', 'Du monde qui m\'entoure=>The world around me', 'la société, la justice=>society, justice',
'De ce qui se passe dans une tête=>What goes on inside a mind', 'mémoire, folie, identité=>memory, madness, identity',
'Rêveur=>Dreamy', 'la tête ailleurs=>head in the clouds', 'Tu as envie de partir où ?=>Where do you want to go?',
'Dans un monde magique=>Into a magical world', 'là où tout est possible=>where anything is possible', 'Dans l\'espace=>Into space',
'un autre monde=>another world', 'Dans le futur=>Into the future', 'ce qui pourrait arriver=>what could happen',
'Dans un dessin animé=>Into a cartoon', 'l\'animation, pour tous=>animation, for everyone',
/* questions : branches */
'Ton rire=>Your laughter', 'Quel rire te ferait du bien ?=>What kind of laugh would do you good?', 'Un rire qui réchauffe=>A warm laugh',
'Un vrai fou rire=>A real belly laugh', 'Un rire amoureux=>A romantic laugh', 'une histoire qui finit bien=>a story that ends well',
'Un rire qui pique=>A biting laugh', 'un peu méchant, un peu noir=>a bit mean, a bit dark', 'Tes frissons=>Your chills',
'Qu\'est-ce qui te fait le plus frissonner ?=>What gives you the most chills?', 'Ta curiosité=>Your curiosity',
'Tu as envie de cogiter sur quoi ?=>What do you want to think about?', 'Le monde qui m\'entoure=>The world around me',
'Ce qui se passe dans une tête=>What goes on inside a mind', 'Ce qui s\'est vraiment passé=>What really happened', 'l\'Histoire, la vraie=>History, the real thing',
'Ce qui pourrait arriver=>What could happen', 'le futur, la science=>the future, science', 'Ton cœur=>Your heart',
'Qu\'est-ce qui te touche le plus ?=>What moves you the most?', 'Une histoire qui serre le cœur=>A heart-wrenching story',
'Une belle histoire d\'amour=>A beautiful love story', 'Les liens d\'une famille=>Family bonds', 'parents, enfants, fratrie=>parents, children, siblings',
'Une histoire portée par la musique=>A story carried by music', 'ça chante, ça danse=>singing and dancing', 'Ton énergie=>Your energy',
'Tu veux la dépenser comment ?=>How do you want to burn it?', 'Bagarres et explosions=>Fights and explosions', 'de l\'action pure=>pure action',
'Au cœur d\'une bataille=>In the heart of a battle', 'Ta surprise=>Your surprise', 'Une histoire vraie incroyable=>An incredible true story',
'Ton repos=>Your rest', 'Qu\'est-ce qui te repose le mieux ?=>What relaxes you best?', 'Un film qui fait du bien=>A feel-good film',
'on en ressort content=>you come out happy', 'Un film réconfortant=>A comforting film', 'comme un plaid=>like a warm blanket',
'Ton évasion=>Your escape', 'Dans l\'espace ou le futur=>Into space or the future', 'Au bout du monde=>To the ends of the earth',
/* questions communes */
'Ton seuil=>Your threshold', 'Tu te sens prêt à être secoué comment ?=>How shaken up are you ready to be?', 'Pas du tout=>Not at all',
'je veux rester tranquille=>I want to stay calm', 'Un peu=>A little', 'de la tension, sans excès=>some tension, nothing extreme', 'Beaucoup=>A lot',
'je veux que ça cogne=>I want it to hit hard', 'À fond=>All the way', 'rien ne me fait peur=>nothing scares me',
'Ton public=>Your audience', 'Tu regardes avec qui ?=>Who are you watching with?', 'Seul=>Alone', 'personne à ménager=>no one to spare',
'À deux=>Just the two of us', 'même écran, même envie=>same screen, same mood', 'Entre amis=>With friends', 'ça commente=>lots of commentary',
'En famille=>With family', 'tous les âges=>all ages', 'Avec des enfants=>With kids', 'rien de dur=>nothing harsh',
'Avec quelqu\'un qui regarde peu de films=>With someone who rarely watches films', 'ça doit rester simple=>it has to stay simple',
'Ton temps=>Your time', 'Tu as combien de temps devant toi ?=>How much time do you have?', 'Moins de 1h25=>Under 1h25', 'vraiment court=>really short',
'format serré=>tight format', 'le format normal=>the usual length', 'on prend la soirée=>we\'re taking the evening', 'Peu importe=>Doesn\'t matter',
'aucune contrainte=>no limit', 'Ton époque=>Your era', 'Tu as envie d\'un film de quelle époque ?=>What era should the film be from?',
'Très récent=>Very recent', '2020 et après=>2020 and later', 'Les années 2010=>The 2010s', 'Les années 2000=>The 2000s', 'Années 80 – 90=>The 80s – 90s',
'l\'âge d\'or vidéo=>the golden age of video', 'Avant 1980=>Before 1980', 'les fondations=>the foundations', 'toutes époques=>any era',
'Dernière question=>Last question', 'Tu préfères un film connu, ou une découverte ?=>Do you prefer a well-known film, or a discovery?',
'Un film très connu=>A very well-known film', 'des millions de spectateurs, peu de risque=>millions of viewers, low risk', 'Assez connu=>Fairly well-known',
'sans être un blockbuster=>without being a blockbuster', 'Un film culte=>A cult film', 'adoré par ceux qui l\'ont vu=>adored by those who\'ve seen it',
'Une découverte=>A discovery', 'peu vu, mais très bien noté=>little seen, but very well rated', 'surprends-moi=>surprise me',
'Plus précisément=>More precisely', 'Plus précisément ?=>More precisely?',
/* questions : sous-choix */
'Feel-good familial=>Family feel-good', 'on ressort léger=>you come out lighter', 'Comédie douce-amère=>Bittersweet comedy', 'ça rit et ça pique=>funny and biting',
'Comédie romantique=>Romantic comedy', 'avec des sentiments=>with feelings', 'Juste drôle=>Just funny', 'rien de plus=>nothing more',
'Délire de science-fiction=>Sci-fi madness', 'les règles sautent=>the rules go out the window', 'Fantaisie décalée=>Offbeat fantasy', 'un monde à part=>a world apart',
'Comédie d\'action=>Action comedy', 'ça explose en riant=>explosions and laughs', 'Humour pur=>Pure humour', 'sans décor=>no frills',
'Romance qui serre le cœur=>Heart-wrenching romance', 'ça fait mal=>it hurts', 'Romance d\'un autre temps=>Romance from another time',
'Romance légère=>Light romance', 'sans complication=>uncomplicated', 'Satire sociale=>Social satire', 'ça vise juste=>right on target',
'Comédie noire criminelle=>Dark crime comedy', 'on rit jaune=>you laugh nervously', 'Humour et guerre=>Humour and war', 'absurde total=>totally absurd',
'Cynisme pur=>Pure cynicism', 'sans filtre=>unfiltered', 'Un mystère à résoudre=>A mystery to solve', 'on cherche avec=>you investigate along',
'Un tueur dans l\'ombre=>A killer in the shadows', 'on le sent venir=>you feel it coming', 'Un drame sous pression=>A drama under pressure',
'ça monte lentement=>it builds slowly', 'La tension pure=>Pure tension', 'rien d\'autre=>nothing else', 'Qui joue avec les nerfs=>That toys with your nerves',
'ça guette=>something\'s lurking', 'Surnaturelle=>Supernatural', 'ça vient d\'ailleurs=>it comes from elsewhere', 'De science-fiction=>Science fiction',
'la menace est autre=>the threat is alien', 'Horreur frontale=>Head-on horror', 'sans détour=>no holding back', 'Fantômes et lieux hantés=>Ghosts and haunted places',
'ça hante=>it haunts', 'Mystère inexpliqué=>Unexplained mystery', 'on ne saura pas tout=>you won\'t learn everything', 'Créatures venues d\'ailleurs=>Creatures from beyond',
'contact hostile=>hostile contact', 'Fantastique sombre=>Dark fantasy', 'le merveilleux qui tourne mal=>wonder gone wrong', 'Une traque=>A manhunt',
'on est la proie=>you\'re the prey', 'Enfermé, piégé=>Locked in, trapped', 'pas d\'issue=>no way out', 'Un monde effondré=>A collapsed world',
'après la fin=>after the end', 'Une nature hostile=>Hostile nature', 'seul dehors=>alone outside', 'Le crime et la justice=>Crime and justice',
'ce qu\'on juge=>what we judge', 'Une époque, un pays=>An era, a country', 'le contexte parle=>the context speaks', 'La guerre et ses traces=>War and its scars',
'ce qui reste=>what remains', 'Le quotidien=>Everyday life', 'à hauteur d\'homme=>on a human scale', 'Une énigme mentale=>A mental puzzle',
'ça se démonte=>it comes apart', 'Une conscience qui vacille=>A wavering mind', 'qui suis-je=>who am I', 'Un secret enfoui=>A buried secret',
'ça remonte=>it resurfaces', 'L\'intime=>The intimate', 'sans artifice=>without artifice', 'Un conflit majeur=>A major conflict',
'la grande échelle=>the big picture', 'Une vie hors norme=>An extraordinary life', 'un destin=>a destiny', 'Un crime réel=>A real crime',
'ça a existé=>it really happened', 'Une grande fresque=>A grand epic', 'le souffle=>sweeping', 'Un futur qui fait peur=>A frightening future',
'ça dérape=>it goes off the rails', 'Un futur intime=>An intimate future', 'à hauteur d\'humain=>on a human scale', 'Un futur en action=>A future in action',
'ça se bat=>there\'s fighting', 'Une idée vertigineuse=>A dizzying idea', 'le concept d\'abord=>concept first', 'Une famille qui se déchire=>A family tearing apart',
'les liens cassent=>bonds break', 'Une histoire vraie=>A true story', 'c\'est arrivé=>it happened', 'Un drame pur=>Pure drama', 'frontal=>head-on',
'Deux êtres, rien d\'autre=>Two people, nothing else', 'en huis clos=>behind closed doors', 'Amour et légèreté=>Love and lightness', 'ça respire=>room to breathe',
'Amour d\'époque=>Period love', 'autre siècle=>another century', 'Amour et destin=>Love and destiny', 'plus grand qu\'eux=>bigger than them',
'Parents et enfants=>Parents and children', 'la transmission=>passing it on', 'À hauteur d\'enfant=>Through a child\'s eyes', 'son regard=>their point of view',
'Une fratrie=>Siblings', 'frères et sœurs=>brothers and sisters', 'Une famille en crise=>A family in crisis', 'ça craque=>it cracks',
'Un biopic musical=>A music biopic', 'une vraie vie=>a real life', 'Une comédie musicale=>A musical', 'ça chante=>there\'s singing',
'Un drame musical=>A musical drama', 'ça coûte cher=>it comes at a price', 'La musique au centre=>Music at the centre', 'elle porte tout=>it carries everything',
'le maximum=>the max', 'Action tendue=>Tense action', 'on serre les dents=>teeth clenched', 'Action et humour=>Action and humour', 'Action pure=>Pure action',
'Un criminel=>A criminal', 'la traque=>the chase', 'Un espion=>A spy', 'le double jeu=>the double game', 'Une course contre la montre=>A race against time',
'le chrono=>the clock is ticking', 'Ça ne s\'arrête jamais=>It never stops', 'plein régime=>full throttle', 'Un plan millimétré=>A meticulous plan',
'tout est prévu=>everything is planned', 'Un casse qui dérape=>A heist gone wrong', 'rien ne va=>nothing goes right', 'Un casse à l\'humour=>A funny heist',
'l\'équipe fait le sel=>the crew makes it', 'Un casse culte=>A cult heist', 'les grands classiques=>the great classics', 'Au front=>On the front line',
'dans la boue=>in the mud', 'Dans l\'Histoire=>In History', 'le contexte compte=>context matters', 'Le drame des civils=>The civilians\' drama',
'de l\'autre côté=>from the other side', 'Le champ de bataille=>The battlefield', 'l\'échelle=>the scale', 'L\'espace=>Space', 'vraiment loin=>really far away',
'Un futur sombre=>A dark future', 'ça a mal tourné=>it went wrong', 'ça retourne la tête=>mind-bending', 'La SF pure=>Pure sci-fi',
'le genre pour lui-même=>the genre for its own sake', 'Une grande quête=>A great quest', 'le long chemin=>the long road', 'Un conte=>A fairy tale',
'pour tous=>for everyone', 'Une magie sombre=>Dark magic', 'ça inquiète=>unsettling', 'Le merveilleux=>The marvellous', 'sans limite=>no limits',
'Une expédition=>An expedition', 'l\'inconnu=>the unknown', 'Un voyage initiatique=>A coming-of-age journey', 'on revient changé=>you come back changed',
'Un monde inconnu=>An unknown world', 'hors carte=>off the map', 'L\'aventure pure=>Pure adventure', 'le mouvement=>always moving',
'Une enquête=>An investigation', 'on cherche le coupable=>find the culprit', 'Une identité=>An identity', 'qui est qui=>who\'s who',
'La réalité elle-même=>Reality itself', 'le sol se dérobe=>the ground gives way', 'Un secret de famille=>A family secret', 'ça sort=>it comes out',
'Doucement décalé=>Gently offbeat', 'un pas de côté=>a step sideways', 'Franchement bizarre=>Downright bizarre', 'ça déraille=>it goes off the rails',
'Inquiétant=>Unsettling', 'ça met mal à l\'aise=>it makes you uneasy', 'Onirique=>Dreamlike', 'comme un rêve=>like a dream', 'Un fait divers=>A news story',
'ça a fait la une=>it made the headlines', 'Un destin hors norme=>An extraordinary destiny', 'une vie entière=>a whole life', 'Un exploit=>A feat',
'sport, survie, sauvetage=>sport, survival, rescue', 'Un moment d\'Histoire=>A moment in History', 'ça a compté=>it mattered', 'Ça rit puis ça serre=>Laughs, then a lump in the throat',
'virage à mi-film=>a turn halfway through', 'Drame avec du fantastique=>Drama with a fantasy twist', 'le réel dérape=>reality slips',
'Comédie qui devient thriller=>Comedy that becomes a thriller', 'ça tourne mal=>it goes wrong', 'Un objet à part=>One of a kind', 'sans étiquette=>no label',
'Une comédie chaleureuse=>A warm comedy', 'ça réchauffe=>it warms you up', 'Une rencontre=>An encounter', 'deux personnes=>two people',
'Un sursaut=>A jolt', 'ça relève=>it lifts you up', 'Rien que du rire=>Nothing but laughs', 'sans arrière-plan=>no subtext',
'Un classique animé=>An animated classic', 'valeur sûre=>a safe bet', 'Une aventure familiale=>A family adventure', 'tout public=>all audiences',
'Un conte réconfortant=>A comforting tale', 'ça berce=>soothing', 'Une comédie familiale=>A family comedy', 'ça rit ensemble=>laughing together',
'Sur la route=>On the road', 'ça bouge=>on the move', 'Une virée mouvementée=>An eventful trip', 'Vers l\'inconnu=>Into the unknown',
'sans danger réel=>no real danger', 'Grand air=>Open air', 'Du blockbuster=>Blockbuster', 'De l\'aventure spectaculaire=>Spectacular adventure',
'le grand jeu=>all-out', 'De l\'action drôle=>Funny action', 'ça ne se prend pas au sérieux=>it doesn\'t take itself seriously',
'Un braquage réjouissant=>A delightful robbery', 'l\'équipe et le plan=>the crew and the plan', 'Pour toute la famille=>For the whole family',
'personne ne s\'ennuie=>nobody gets bored', 'Une aventure animée=>An animated adventure', 'Animation qui touche=>Moving animation', 'ça serre=>it tugs at you',
'Animation qui fait rire=>Funny animation', 'ça pétille=>it sparkles',
'Une comédie qui fait du bien, mais laquelle ?=>A feel-good comedy, but which kind?', 'Jusqu\'où part l\'absurde ?=>How absurd should it get?',
'Quelle romance ?=>What kind of romance?', 'Grinçant comment ?=>Biting how?', 'La tension vient d\'où ?=>Where does the tension come from?',
'Quelle horreur ?=>What kind of horror?', 'D\'où vient l\'étrange ?=>Where does the strangeness come from?', 'Survivre à quoi ?=>Survive what?',
'Quel angle ?=>Which angle?', 'Explorer quoi ?=>Explore what?', 'Quelle Histoire ?=>Which History?', 'Quel futur ?=>What future?',
'Ça remue comment ?=>Moving how?', 'Quels liens ?=>Which bonds?', 'La musique comment ?=>Music how?',
'L\'action, ça donne quoi ?=>What kind of action?', 'On poursuit quoi ?=>Chasing what?', 'Quel casse ?=>What kind of heist?', 'Quelle guerre ?=>Which war?',
'Quel ailleurs ?=>Where else?', 'Quelle magie ?=>What kind of magic?', 'Partir où ?=>Go where?', 'Le retournement porte sur quoi ?=>What does the twist hinge on?',
'Étrange à quel point ?=>How strange?', 'Quelle histoire vraie ?=>Which true story?', 'Inclassable comment ?=>Unclassifiable how?',
'Du bien, mais comment ?=>Good how?', 'Ton doudou, c\'est plutôt…=>Your comfort film is more…', 'Une aventure comment ?=>What kind of adventure?',
'Le divertissement pur, c\'est…=>Pure entertainment means…', 'Quelle animation ?=>What kind of animation?',
'CinéMood — le bon film pour ton moment=>CinéMood — the right film for your moment'
  ];
  var DICT = {};
  RAW.forEach(function (r) { var i = r.indexOf('=>'); DICT[norm(r.slice(0, i))] = r.slice(i + 2); });

  /* textes composés par le moteur (explications, filtres, compteurs) */
  var FRAG = [
    [/(\d[\d\s.,]*) films passent tes filtres\. Voici les (\d+) qui collent le mieux\./, '$1 films pass your filters. Here are the $2 that fit best.'],
    [/puis (\d+) questions qui s'adaptent à tes réponses : ton envie précise, avec qui tu regardes, le temps que tu as, l'époque\. Moins d'une minute\./, 'then $1 questions that adapt to your answers: what exactly you want, who you\'re watching with, how much time you have, the era. Under a minute.'],
    [/^Heureux, triste, amoureux, crevé… /, 'Happy, sad, in love, worn out… '],
    [/^Ticket N° ?(\d+)$/, 'Ticket No. $1'],
    [/^Touches 1–(\d+) pour répondre · ← pour revenir$/, 'Keys 1–$1 to answer · ← to go back'],
    [/^(\d+) questions · une minute$/, '$1 questions · one minute'],
    [/Trop peu de films correspondent à ce chemin exact\. Pour t'en proposer quand même, j'ai ouvert /, 'Too few films match this exact path. To still give you some, I opened up '],
    [/Aucun film ne réunit exactement « (.+?) » avec tes autres réponses\. Voici les plus proches de ton envie principale\./, 'No film combines « $1 » exactly with your other answers. Here are the closest to your main mood.'],
    [/Le catalogue n'a pas répondu \((.*?)\)\. Réessaie dans un instant\./, 'The catalogue didn\'t respond ($1). Try again in a moment.'],
    [/Le meilleur terrain d\u2019entente : il respecte (\d+) réponses sur 8 de la 1re personne et (\d+) sur 8 de la 2e\. /g, 'The best common ground: it matches $1 of the 1st person\'s 8 answers and $2 of the 2nd\'s. '],
    [/Il tient pour vous deux : /g, 'It works for both of you: '], [/% pour la 1re personne, /g, '% for the 1st person, '], [/% pour la 2e\./g, '% for the 2nd.'],
    [/noté ([\d.]+)\/10 sur ([\d\s.,]+) votes/g, 'rated $1/10 from $2 votes'],
    [/il croise exactement /g, 'it blends exactly '], [/il mêle /g, 'it blends '], [/ \(1re personne\) et /g, ' (1st person) and '], [/\(2e personne\)/g, '(2nd person)'],
    [/côté genre, il suit la 1re personne/g, 'genre-wise, it follows the 1st person'], [/côté genre, il suit la 2e personne/g, 'genre-wise, it follows the 2nd person'],
    [/c'est (?:du |de la |de l')([^,.]+?) mêlé (?:au |à la |à l')([^,.]+)/g, 'it\'s $1 mixed with $2'],
    [/, que vous vouliez tous les deux/g, ', which you both wanted'],
    [/c'est (?:du |de la |de l')([^,.]+)/g, 'it\'s $1'],
    [/, pile ta durée/g, ', right on your time'], [/, dans ton créneau/g, ', within your time'], [/, dans le temps que vous avez tous les deux/g, ', within the time you both have'],
    [/une intensité proche de ton niveau \(/g, 'an intensity close to your level ('], [/ demandée\)/g, ' requested)'],
    [/, exactement ton niveau/g, ', exactly your level'], [/une intensité /g, 'an intensity '],
    [/ça tient en solo/g, 'works solo'], [/ça tient à deux/g, 'works as a couple'], [/ça tient entre amis/g, 'works with friends'],
    [/ça tient en famille/g, 'works for the family'], [/ça tient avec des enfants/g, 'works with kids'], [/ça tient avec quelqu'un qui regarde peu de films/g, 'works with someone who rarely watches films'],
    [/ça tient /g, 'works '], [/ambiance /g, 'mood: '], [/Tu voulais /g, 'You wanted '], [/Réalisé par /g, 'Directed by '],
    [/croisement : /g, 'blend: '], [/genres : /g, 'genres: '], [/ ou /g, ' or '], [/sans : /g, 'without: '], [/durée : sans contrainte/g, 'length: no limit'],
    [/durée (\d+)–(\d+) min \(cible (\d+)\)/g, 'length $1–$2 min (target $3)'], [/intensité visée /g, 'target intensity '],
    [/^sortie (\d{4})–(\d{4})$/, 'released $1–$2'], [/note ≥ /g, 'rating ≥ '], [/langue : /g, 'language: '], [/tous publics \(≤ 12\)/g, 'all audiences (≤ 12)'],
    [/très douce/g, 'very gentle'], [/très forte/g, 'very strong'], [/\bdouce\b/g, 'gentle'], [/\bmoyenne\b/g, 'medium'], [/\bforte\b/g, 'strong'],
    [/ambiance sombre/g, 'dark mood'], [/violence crue/g, 'raw violence'], [/\bhumour\b/g, 'humour'],
    [/vos durées ne se recoupent pas, on garde la plus courte/g, 'your lengths don\'t overlap, we keep the shorter one'],
    [/époques différentes, on couvre les deux/g, 'different eras, we cover both'],
    [/la notoriété/g, 'how well-known it is'], [/les années de sortie/g, 'the release years'], [/la durée/g, 'the length'], [/la langue/g, 'the language'],
    [/le croisement de genres/g, 'the genre blend'], [/tout le reste/g, 'everything else'],
    [/\bComédie\b/g, 'Comedy'], [/\bcomédie\b/g, 'comedy'], [/\bAventure\b/g, 'Adventure'], [/\baventure\b/g, 'adventure'], [/\bPolicier\b/g, 'Crime'], [/\bpolicier\b/g, 'crime'],
    [/\bDocumentaire\b/g, 'Documentary'], [/\bDrame\b/g, 'Drama'], [/\bdrame\b/g, 'drama'], [/\bFamille\b/g, 'Family'], [/\bFantastique\b/g, 'Fantasy'], [/\bfantastique\b/g, 'fantasy'],
    [/\bHistoire\b/g, 'History'], [/\bHorreur\b/g, 'Horror'], [/\bhorreur\b/g, 'horror'], [/\bMusique\b/g, 'Music'], [/\bMystère\b/g, 'Mystery'], [/\bmystère\b/g, 'mystery'],
    [/\bScience-fiction\b/g, 'Science fiction'], [/\bscience-fiction\b/g, 'science fiction'], [/\bGuerre\b/g, 'War'], [/\bguerre\b/g, 'war'], [/\bTéléfilm\b/g, 'TV movie']
  ];

  function tr(s) {
    var k = norm(s);
    if (!k) return s;
    if (DICT[k] !== undefined) {
      var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
      return lead + DICT[k] + trail;
    }
    if (!/[a-zà-ÿ]{2}/i.test(k)) return s;
    var out = s.replace(/\u2019/g, "'");
    FRAG.forEach(function (r) { out = out.replace(r[0], r[1]); });
    return out === s.replace(/\u2019/g, "'") ? s : out;
  }
  api.t = tr;

  /* chaque nœud garde sa version française : on bascule dans les deux sens sans recharger */
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var TXT = new WeakMap(), ATT = new WeakMap(), titleFr = null, active = false;
  function skip(n) { var p = n.parentNode; return !p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'TEXTAREA'; }
  function textNode(n) {
    if (skip(n)) return;
    var v = n.nodeValue, rec = TXT.get(n);
    if (rec && v === rec.en) return;
    var t = tr(v);
    TXT.set(n, {fr: v, en: t});
    if (t !== v) n.nodeValue = t;
  }
  function el(e) {
    if (!e.getAttribute) return;
    ATTRS.forEach(function (a) {
      var v = e.getAttribute(a);
      if (!v) return;
      var m = ATT.get(e) || {}, rec = m[a];
      if (rec && v === rec.en) return;
      var t = tr(v);
      m[a] = {fr: v, en: t}; ATT.set(e, m);
      if (t !== v) e.setAttribute(a, t);
    });
  }
  function each(root, fnText, fnEl) {
    if (!root) return;
    if (root.nodeType === 3) return fnText(root);
    if (root.nodeType !== 1 || root.nodeName === 'SCRIPT' || root.nodeName === 'STYLE') return;
    fnEl(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) fnText(n); else fnEl(n); }
  }
  function restoreText(n) { var rec = TXT.get(n); if (rec && n.nodeValue === rec.en && rec.en !== rec.fr) n.nodeValue = rec.fr; }
  function restoreEl(e) {
    var m = ATT.get(e); if (!m) return;
    Object.keys(m).forEach(function (a) { if (e.getAttribute(a) === m[a].en && m[a].en !== m[a].fr) e.setAttribute(a, m[a].fr); });
  }
  var obs = new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') el(m.target);
      else m.addedNodes.forEach(function (n) { each(n, textNode, el); });
    });
  });
  function start() {
    if (active) return; active = true;
    document.documentElement.setAttribute('lang', 'en');
    obs.observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
    if (document.body) { if (titleFr === null) titleFr = document.title; document.title = tr(titleFr); each(document.body, textNode, el); }
  }
  function stop() {
    if (!active) return; active = false;
    obs.disconnect();
    document.documentElement.setAttribute('lang', 'fr');
    if (titleFr !== null) document.title = titleFr;
    each(document.documentElement, restoreText, restoreEl);
  }
  api.toggle = function () {
    lang = lang === 'en' ? 'fr' : 'en';
    api.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    if (lang === 'en') start(); else stop();
    try { window.dispatchEvent(new Event('cinemood:lang')); } catch (e) {}
  };
  api.t = function (s) { return active ? tr(s) : s; };
  if (lang === 'en') start();
  document.addEventListener('DOMContentLoaded', function () {
    titleFr = titleFr === null ? document.title : titleFr;
    if (active) { document.title = tr(titleFr); each(document.body, textNode, el); }
  });
  return api;
})();

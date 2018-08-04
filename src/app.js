Vue.component('character-profile', {
    template: '<div><h4>{{ character.header }}:</h4><div>{{ character.name }}</div></div>',
    props: ['character']
});

Vue.component('movie-info', {
    template: '#movieInfo',
    props: ['movie'],
    computed: {
      fetchedCharacters() {
        return this.$root.fetchedData.characters;
      },
      getCharacterNames() {
        let urls = this.movie.characters,
            lookup = this.fetchedCharacters,
            names;

        if (urls && lookup) {
            names = [];
            urls.forEach((url) => {
                let found = lookup.find(character => character.url === url);

                if (found && found.name) {
                    names.push(found.name);
                }
            });
        }
        return names;
      }
    }
});

Vue.component('crawl-chart', {
    template: '#crawlChart',
    props: ['data', 'title', 'scale'],
    computed: {
      getChartHeight() {
        const maxValue = this.$props.data.reduce(
            (max, item) => Math.max(max, item.length)
            , 0);

        // Roundup max chart value to next nearest ten's place.
        return (10 + maxValue - (maxValue%10));
      }
    }
});

const URLS = {
    fetchPosters: 'https://api.themoviedb.org/4/list/22123?api_key=dd439a593fbee7456c76b32c1db44dd1',
    fetchFilms: 'https://swapi.co/api/films',
    fetchCharacters: 'https://swapi.co/api/people/'
};

const mapper = {
    mapMovieResponseResults(response) {
        return response.results.map((obj) => ({
            posterUrl: null,
            title: obj.title,
            director: obj.director,
            characters: obj.characters.slice(0,3),
            releaseDate: obj.release_date,
            openingCrawl: obj.opening_crawl,
            episode: obj.episode_id
        }));
    },
    mapCharacterResponseResults(results) {
        return results.map((obj) => ({
            name: obj.name,
            height: obj.height,
            mass: obj.mass,
            hairColor: obj.hair_color,
            skinColor: obj.skin_color,
            eyeColor: obj.eye_color,
            birthYear: obj.birth_year,
            gender: obj.gender,
            url: obj.url
        }));
    },
    mapPosterResponseResults(response) {
        const imgRoot = 'https://image.tmdb.org/t/p/w300/';
        return response.results.map((obj) => ({
            releaseDate: obj.release_date,
            posterUrl: imgRoot + obj.poster_path,
        }));
    },
    mapOpeningCrawlData(films) {
        return films.map((item) => {
            const splitText = item.openingCrawl.match(/\b(\w+)\b/g);
            return {
                text: item.openingCrawl,
                length: splitText.length,
                split: splitText,
                label: 'ep. ' + item.episode,
                episode: item.episode
            };
        });
    }
};

var resolveToJson = (response) => {
    return response.json();
};

var fetchCharacterData = () => {
  let fetchCharacters = (url, characterData) => {
      return fetch(url)
          .then(resolveToJson)
          .then((data) => {
              const results = characterData.concat(data.results);

              return (data.next) ?
                  fetchCharacters(data.next, results) :
                  mapper.mapCharacterResponseResults(results);
      });
  };
  return fetchCharacters(URLS.fetchCharacters, []);
};

var fetchFilmData = () => {
    const posterRequestData = {
        api_key: 'dd439a593fbee7456c76b32c1db44dd1'
    };

    let filmData = fetch(URLS.fetchFilms)
        .then(resolveToJson)
        .then(mapper.mapMovieResponseResults);

    let posterData = fetch(URLS.fetchPosters, posterRequestData)
        .then(resolveToJson)
        .then(mapper.mapPosterResponseResults);

    return Promise.all([filmData, posterData]);
};

window.onload = () => {
    var vm = new Vue({
        el: '#app',
        data() {
          return {
              favoriteCharacters: {
                most: { name: 'Boba Fett', header: 'Favorite Character' },
                least: { name: 'Jar Jar Binks', header: 'Least Favorite Character' }
              },
              fetchedData: {
                films: [],
                characters: []
              }
          };
        },
        mounted() {
          fetchCharacterData().then((data) => {
              vm.$set(vm.fetchedData, 'characters', data);
          });
          fetchFilmData().then(this.mergeFilmData);
        },
        computed: {
            filmPairs() {
                let pairs = [], i = 0, films = this.fetchedData.films || [], l=films.length;
                for(; i < l; i+=2) {
                    pairs.push(films.slice(i, i+2));
                }
                return pairs;
            },
            openingCrawlData() {
                return mapper
                    .mapOpeningCrawlData(this.fetchedData.films)
                    .sort((a, b) => a.episode < b.episode ? -1 : 1 );
              }
        },
        methods: {
          findCharacterByName(name) {
            return fetchedData.characters.find(character => character.name === name);
          },
          mergeFilmData(promises) {
              let filmData = promises[0], posterData = promises[1];

              // No idea how to key these up. Titles do not match nor does release date.
              // Best idea is to check same result count and sort by date.
              // Assumption that no two movies are released on the same day.
              if (posterData && filmData && posterData.length === filmData.length) {
                  let dateSort = (a, b) => {
                    return (a.releaseDate < b.releaseDate) ? -1 : 1;
                  };

                  // Sort by Date
                  posterData.sort(dateSort);
                  filmData.sort(dateSort);

                  // Find best matching poster from posters
                  var mergedData = filmData.map((film, i) => {
                    film.posterUrl = posterData[i].posterUrl;
                    return film;
                  });

                  this.$set(this.fetchedData, 'films', mergedData);
              }
          }
        }
    });
};

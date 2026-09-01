import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../components/HomePage.vue'
import ParchmentPage from '../components/ParchmentPage.vue'
import ProfilePage from '../components/ProfilePage.vue'
import RapportsPage from '../components/RapportsPage.vue'
import RapportDetailPage from '../components/RapportDetailPage.vue'
import SpheresPage from '../components/SpheresPage.vue'
import SphereDetailPage from '../components/SphereDetailPage.vue'
import ProjetsPage from '../components/ProjetsPage.vue'
import ProjetDetailPage from '../components/ProjetDetailPage.vue'

const routes = [
  { path: '/',               component: ParchmentPage    },
  { path: '/parchemin',      component: HomePage         },
  { path: '/profil',         component: ProfilePage      },
  { path: '/rapports',       component: RapportsPage     },
  { path: '/rapports/:token', component: RapportDetailPage },
  { path: '/spheres',         component: SpheresPage       },
  { path: '/spheres/:id',     component: SphereDetailPage  },
  { path: '/projets',         component: ProjetsPage       },
  { path: '/projets/:token',  component: ProjetDetailPage  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

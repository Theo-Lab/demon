import { createRouter, createWebHistory } from 'vue-router'
import { currentUser } from '../auth.js'
import HomePage from '../components/HomePage.vue'
import ParchmentPage from '../components/ParchmentPage.vue'
import ProfilePage from '../components/ProfilePage.vue'
import RapportsPage from '../components/RapportsPage.vue'
import RapportDetailPage from '../components/RapportDetailPage.vue'
import SpheresPage from '../components/SpheresPage.vue'
import SphereDetailPage from '../components/SphereDetailPage.vue'
import ProjetsPage from '../components/ProjetsPage.vue'
import ProjetDetailPage from '../components/ProjetDetailPage.vue'
import ParisPage from '../components/ParisPage.vue'
import ParcheminsPage from '../components/ParcheminsPage.vue'
import ParcheminDetailPage from '../components/ParcheminDetailPage.vue'
import SlotsPage from '../components/SlotsPage.vue'
import CasinoPage from '../components/CasinoPage.vue'
import RoulettePage from '../components/RoulettePage.vue'
import BlackjackPage from '../components/BlackjackPage.vue'
import CasinoAdminPage from '../components/SlotsAdminPage.vue'
import AdminPage from '../components/AdminPage.vue'
import BlackjackLobbyPage from '../components/BlackjackLobbyPage.vue'
import BlackjackTablePage from '../components/BlackjackTablePage.vue'
import CrossroadPage from '../components/CrossroadPage.vue'
import MinesPage from '../components/MinesPage.vue'

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
  { path: '/paris',           component: ParisPage          },
  { path: '/parchemins',        component: ParcheminsPage      },
  { path: '/parchemins/:token', component: ParcheminDetailPage },
  { path: '/casino',            component: CasinoPage         },
  { path: '/roulette',          component: RoulettePage       },
  { path: '/blackjack',         component: BlackjackPage      },
  { path: '/blackjack/lobby',   component: BlackjackLobbyPage },
  { path: '/blackjack/table/:id', component: BlackjackTablePage },
  { path: '/admin',              component: AdminPage,           meta: { superAdminOnly: true } },
  { path: '/casino/admin',      component: CasinoAdminPage,    meta: { adminOnly: true } },
  { path: '/slots',             component: SlotsPage          },
  { path: '/crossroad',         component: CrossroadPage      },
  { path: '/mines',             component: MinesPage          },
  { path: '/slots/admin',       redirect: '/casino/admin'     },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.adminOnly && !['admin', 'groupier'].includes(currentUser.value?.role)) {
    return '/'
  }
  if (to.meta.superAdminOnly && currentUser.value?.role !== 'admin') {
    return '/'
  }
})

export default router

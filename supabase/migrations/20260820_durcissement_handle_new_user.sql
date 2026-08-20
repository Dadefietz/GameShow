-- Durcissement : `handle_new_user()` ne doit pas être appelable depuis l'API REST.
--
-- Signalé par les avertissements de sécurité Supabase (0028 et 0029). La fonction
-- est déclarée `security definer` — elle s'exécute donc avec les privilèges de son
-- propriétaire — et vit dans le schéma `public`, exposé par PostgREST. N'importe
-- quel appelant, même non connecté, pouvait donc l'invoquer via
-- `/rest/v1/rpc/handle_new_user`.
--
-- En pratique elle échouerait hors d'un contexte de déclencheur (elle lit `new`),
-- mais une fonction à privilèges élevés qui n'a aucune raison d'être publique ne
-- doit pas être publiquement appelable : on ne laisse pas une porte ouverte au
-- motif qu'elle donne sur un mur.
--
-- Le déclencheur continue de fonctionner : l'insertion dans `auth.users` est faite
-- par le rôle d'administration de l'authentification, pas par `anon` ni par
-- `authenticated`. Ce retrait ne touche donc pas la création automatique du profil.
--
-- Réversible d'une ligne (`grant execute ... to ...`) si besoin.

revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

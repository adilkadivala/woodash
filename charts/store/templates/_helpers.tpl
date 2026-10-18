{{- define "store.labels" -}}
app.kubernetes.io/name: store
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
urumi.ai/store: {{ .Values.store.slug | quote }}
{{- end }}

{{- define "store.resources" -}}
{{- with . }}
resources:
  requests:
    cpu: {{ .requests.cpu | quote }}
    memory: {{ .requests.memory | quote }}
  limits:
    cpu: {{ .limits.cpu | quote }}
    memory: {{ .limits.memory | quote }}
{{- end }}
{{- end }}
